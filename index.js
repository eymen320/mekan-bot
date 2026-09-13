const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const express = require('express');

// 7/24 Açık Kalma İçin Web Sunucusu (Render / UptimeRobot İçin)
const app = express();
app.get('/', (req, res) => res.send('Mekan Bot 7/24 Aktif!'));
app.listen(3000, () => console.log('🌐 Web sunucusu 3000 portunda dinleniyor.'));

// Discord Bot Kurulumu
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Bot Ayarları
const PREFIX = 'M.';
const TOKEN = 'MTU0ODY0NzkyNTA0MTg1NjYyMw.GsSDn9.hVYWb_RCmQtK-rhaV-euhLCZoSDrE9Xn0Q34XQ';

// Geçici Veri Depoları
const xpData = new Map();
const warnings = new Map();

client.once('ready', () => {
    console.log(`🤖 Mekan botu başarıyla aktif oldu! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('M.yardım | Mekan Bot');
});

// XP ve Seviye Sistemi Mantığı
function addXP(userId, amount) {
    let userData = xpData.get(userId) || { xp: 0, level: 1 };
    userData.xp += amount;
    
    let nextLevelXp = userData.level * 100;
    if (userData.xp >= nextLevelXp) {
        userData.level += 1;
        userData.xp -= nextLevelXp;
    }
    
    xpData.set(userId, userData);
    return userData;
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Her mesaj gönderildiğinde XP kazandır
    const randomXP = Math.floor(Math.random() * 11) + 5;
    addXP(message.author.id, randomXP);

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ------------------ M.xp ------------------
    if (command === 'xp' || command === 'seviye') {
        const target = message.mentions.users.first() || message.author;
        const userData = xpData.get(target.id) || { xp: 0, level: 1 };
        const nextLevelXp = userData.level * 100;

        const embed = new EmbedBuilder()
            .setTitle(`✨ ${target.username} - XP & Seviye Bilgisi`)
            .setColor('#5865F2')
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: '📊 Seviye', value: `**${userData.level}**`, inline: true },
                { name: '⭐ Toplam XP', value: `**${userData.xp} / ${nextLevelXp}**`, inline: true }
            )
            .setFooter({ text: 'Mekan Bot XP Sistemi' });

        return message.reply({ embeds: [embed] });
    }

    // ------------------ M.yardım ------------------
    if (command === 'yardım' || command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🛠️ Mekan Bot - Komut Listesi')
            .setColor('#2F3136')
            .setDescription(`Tüm komutlar **${PREFIX}** ön eki ile çalışır.`)
            .addFields(
                { name: '✨ Genel Komutlar', value: '`M.xp` - XP ve seviyenizi gösterir.\n`M.ping` - Botun gecikme süresini gösterir.' },
                { name: '🛡️ Moderasyon Komutları', value: '`M.ban @kullanıcı [sebep]` - Kullanıcıyı yasaklar.\n`M.mute @kullanıcı [süre(dk)] [sebep]` - Kullanıcıyı susturur.\n`M.unmute @kullanıcı` - Mute kaldırır.\n`M.uyar @kullanıcı [sebep]` - Kullanıcıya uyarı verir.\n`M.uyarılar @kullanıcı` - Uyarılara bakar.' }
            );

        return message.reply({ embeds: [embed] });
    }

    // ------------------ M.ban ------------------
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ Bu komutu kullanmak için **Üyeleri Yasakla** yetkisine sahip olmalısınız.');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Lütfen yasaklanacak kullanıcıyı etiketleyin.');
        if (!member.bannable) return message.reply('❌ Bu kullanıcıyı yasaklamak için yetkim yetersiz.');

        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        await member.ban({ reason });
        return message.reply(`✅ **${member.user.tag}** sunucudan yasaklandı. Sebep: *${reason}*`);
    }

    // ------------------ M.mute ------------------
    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Bu komut için yetkiniz yok.');
        }

        const member = message.mentions.members.first();
        const duration = parseInt(args[1]);
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi.';

        if (!member) return message.reply('❌ Lütfen bir kullanıcı etiketleyin. Örnek: `M.mute @kullanıcı 10 Kural ihlali`');
        if (!duration || isNaN(duration)) return message.reply('❌ Lütfen dakika cinsinden geçerli bir süre girin.');

        try {
            await member.timeout(duration * 60 * 1000, reason);
            return message.reply(`🔇 **${member.user.tag}**, **${duration}** dakika boyunca susturuldu. Sebep: *${reason}*`);
        } catch (err) {
            return message.reply('❌ Kullanıcı susturulurken bir hata oluştu.');
        }
    }

    // ------------------ M.unmute ------------------
    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Bu yetkiye sahip değilsiniz.');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Lütfen bir kullanıcı etiketleyin.');

        try {
            await member.timeout(null);
            return message.reply(`🔊 **${member.user.tag}** kullanıcısının susturulması kaldırıldı.`);
        } catch (err) {
            return message.reply('❌ Mute kaldırılırken hata oluştu.');
        }
    }

    // ------------------ M.uyar ------------------
    if (command === 'uyar') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Bu komut için **Mesajları Yönet** yetkisi gereklidir.');
        }

        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Lütfen uyarılacak kullanıcıyı etiketleyin.');

        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        const userWarnings = warnings.get(user.id) || [];
        
        userWarnings.push({ reason, date: new Date().toLocaleDateString('tr-TR') });
        warnings.set(user.id, userWarnings);

        return message.reply(`⚠️ **${user.tag}** başarıyla uyarıldı. (Toplam Uyarı: ${userWarnings.length}) | Sebep: *${reason}*`);
    }

    // ------------------ M.uyarılar ------------------
    if (command === 'uyarılar') {
        const user = message.mentions.users.first() || message.author;
        const userWarnings = warnings.get(user.id) || [];

        if (userWarnings.length === 0) {
            return message.reply(`🎉 **${user.tag}** kullanıcısının hiç uyarısı yok.`);
        }

        let warnList = userWarnings.map((w, index) => `**${index + 1}.** ${w.reason} *(Tarih: ${w.date})*`).join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle(`⚠️ ${user.username} - Uyarı Geçmişi`)
            .setColor('#FF0000')
            .setDescription(warnList);

        return message.reply({ embeds: [embed] });
    }

    // ------------------ M.ping ------------------
    if (command === 'ping') {
        return message.reply(`🏓 Pong! Bot Gecikmesi: **${client.ws.ping}ms**`);
    }
});

client.login(TOKEN);