const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const express = require('express');

// 7/24 Açık Kalma İçin Web Sunucusu
const app = express();
app.get('/', (req, res) => res.send('Mekan Bot 7/24 Aktif!'));
app.listen(3000, () => console.log('🌐 Web sunucusu 3000 portunda dinleniyor.'));

// Discord Bot Kurulumu
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Bot Ayarları
const PREFIX = 'M.';
const TOKEN = process.env.TOKEN;

// Geçici Veri Depoları
const xpData = new Map();
const warnings = new Map();
const afkData = new Map();

// İngilizce Süre Dönüştürücü Fonksiyon (1m, 1h, 1d, 30s)
function parseDuration(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d+)([smhd])$/i);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

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

    // --- AFK KONTROLLERİ ---
    if (afkData.has(message.author.id)) {
        afkData.delete(message.author.id);
        message.reply(`👋 Hoş geldin **${message.author.username}**, AFK modundan çıkarıldın!`).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        });
    }

    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (afkData.has(user.id)) {
                const info = afkData.get(user.id);
                message.reply(`💤 **${user.username}** şu anda AFK!\n📝 **Sebep:** ${info.reason}\n⏰ **AFK Olma Zamanı:** <t:${Math.floor(info.timestamp / 1000)}:R>`);
            }
        });
    }

    // Her mesaj gönderildiğinde XP kazandır
    const randomXP = Math.floor(Math.random() * 11) + 5;
    addXP(message.author.id, randomXP);

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ------------------ M.afk ------------------
    if (command === 'afk') {
        const reason = args.join(' ') || 'Sebep belirtilmedi.';
        afkData.set(message.author.id, {
            reason: reason,
            timestamp: Date.now()
        });

        return message.reply(`💤 Başarıyla AFK moduna geçtin!\n📝 **Sebep:** ${reason}\n*Mesaj yazdığında AFK modun otomatik kapanacak.*`);
    }

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

    // ------------------ M.avatar ------------------
    if (command === 'avatar') {
        const target = message.mentions.users.first() || message.author;
        const avatarUrl = target.displayAvatarURL({ dynamic: true, size: 1024 });

        const embed = new EmbedBuilder()
            .setTitle(`🖼️ ${target.username} Profil Resmi`)
            .setColor('#5865F2')
            .setImage(avatarUrl)
            .setDescription(`[Resmi İndir](${avatarUrl})`);

        return message.reply({ embeds: [embed] });
    }

    // ------------------ M.banner ------------------
    if (command === 'banner') {
        const target = message.mentions.users.first() || message.author;
        const fetchedUser = await client.users.fetch(target.id, { force: true });

        if (!fetchedUser.banner) {
            return message.reply('❌ Bu kullanıcının ayarlanmış bir profil afişi (banner) yok.');
        }

        const bannerUrl = fetchedUser.bannerURL({ dynamic: true, size: 1024 });
        const embed = new EmbedBuilder()
            .setTitle(`🎨 ${target.username} Banner Resmi`)
            .setColor('#5865F2')
            .setImage(bannerUrl)
            .setDescription(`[Resmi İndir](${bannerUrl})`);

        return message.reply({ embeds: [embed] });
    }

    // ------------------ M.profil ------------------
    if (command === 'profil') {
        const target = message.mentions.members.first() || message.member;
        const roles = target.roles.cache.filter(r => r.name !== '@everyone').map(r => r).join(', ') || 'Yok';

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${target.user.username} Kullanıcı Profili`)
            .setColor('#5865F2')
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🏷️ Kullanıcı Adı', value: target.user.tag, inline: true },
                { name: '🆔 ID', value: target.user.id, inline: true },
                { name: '📅 Discord Katılım', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: false },
                { name: '📥 Sunucuya Katılım', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: false },
                { name: '📜 Roller', value: roles, inline: false }
            );

        return message.reply({ embeds: [embed] });
    }

    // ------------------ M.sunucubilgi ------------------
    if (command === 'sunucubilgi' || command === 'serverinfo') {
        const { guild } = message;
        const embed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name} Sunucu Bilgileri`)
            .setColor('#5865F2')
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👑 Sunucu Sahibi', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Toplam Üye', value: `**${guild.memberCount}**`, inline: true },
                { name: '💬 Kanal Sayısı', value: `**${guild.channels.cache.size}**`, inline: true },
                { name: '📅 Kuruluş Tarihi', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: false }
            );

        return message.reply({ embeds: [embed] });
    }

    // ==================== OYUN & EĞLENCE KOMUTLARI ====================

    // ------------------ M.yazıtura ------------------
    if (command === 'yazıtura') {
        const results = ['Yazı 🪙', 'Tura 🪙'];
        const outcome = results[Math.floor(Math.random() * results.length)];
        return message.reply(`🪙 Para havaya atıldı ve... **${outcome}** geldi!`);
    }

    // ------------------ M.zar ------------------
    if (command === 'zar') {
        const dice = Math.floor(Math.random() * 6) + 1;
        return message.reply(`🎲 Zar atıldı: **${dice}** geldi!`);
    }

    // ------------------ M.8ball ------------------
    if (command === '8ball') {
        const question = args.join(' ');
        if (!question) return message.reply('❌ Lütfen 8ball\'a bir soru sorun. Örnek: `M.8ball Bugün şanslı mıyım?`');

        const answers = [
            'Evet, kesinlikle! ✨',
            'Buna hiç şüphe yok. 👍',
            'Büyük ihtimalle evet. 😊',
            'Görünüşe göre evet. 🔮',
            'Tam olarak emin değilim, tekrar sor. 🤔',
            'Daha sonra tekrar dene. ⏳',
            'Şu an tahmin edemiyorum. 🌫️',
            'Pek sanmıyorum. 👎',
            'Cevabım hayır. ❌',
            'Şüphen bile olmasın: Hayır! 🙅'
        ];
        const reply = answers[Math.floor(Math.random() * answers.length)];

        const embed = new EmbedBuilder()
            .setTitle('🔮 8Ball Sihirli Küre')
            .setColor('#9B59B6')
            .addFields(
                { name: '❓ Soru', value: question },
                { name: '💬 Cevap', value: reply }
            );

        return message.reply({ embeds: [embed] });
    }

    // ------------------ M.düello ------------------
    if (command === 'düello' || command === 'duello') {
        const opponent = message.mentions.members.first();
        if (!opponent) return message.reply('❌ Lütfen düello yapmak istediğiniz kişiyi etiketleyin.');
        if (opponent.id === message.author.id) return message.reply('❌ Kendinizle düello yapamazsınız!');
        if (opponent.user.bot) return message.reply('❌ Botlarla düello yapamazsınız!');

        const winner = Math.random() < 0.5 ? message.author : opponent.user;
        const loser = winner.id === message.author.id ? opponent.user : message.author;
        const winnerHp = Math.floor(Math.random() * 40) + 10;

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Düello Sonucu!')
            .setColor('#E74C3C')
            .setDescription(`**${message.author.username}** vs **${opponent.user.username}**\n\n🔥 Kıyasıya bir mücadeleden sonra **${winner.username}**, **${loser.username}** karşısında zafer kazandı!\n❤️ Kalan Can: **${winnerHp} HP**`);

        return message.reply({ embeds: [embed] });
    }

    // ==================== SUNUCU İÇİ KULLANIŞLI ARAÇLAR ====================

    // ------------------ M.duyuru ------------------
    if (command === 'duyuru') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');
        }

        const text = args.join(' ');
        if (!text) return message.reply('❌ Lütfen duyuru metnini yazın. Örnek: `M.duyuru Sunucuda yeni kurallar eklendi!`');

        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle('📢 Sunucu Duyurusu')
            .setColor('#F1C40F')
            .setDescription(text)
            .setFooter({ text: `${message.author.username} tarafından duyuruldu`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        return message.channel.send({ embeds: [embed] });
    }

    // ------------------ M.oylama ------------------
    if (command === 'oylama') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');
        }

        const question = args.join(' ');
        if (!question) return message.reply('❌ Lütfen oylama konusunu belirtin. Örnek: `M.oylama Bu akşam etkinlik yapalım mı?`');

        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle('📊 Oylama Başladı!')
            .setColor('#3498DB')
            .setDescription(`**${question}**\n\nOy vermek için aşağıdaki tepkileri kullanabilirsiniz!`)
            .setFooter({ text: `Oylamayı başlatan: ${message.author.username}` })
            .setTimestamp();

        const pollMsg = await message.channel.send({ embeds: [embed] });
        await pollMsg.react('👍');
        await pollMsg.react('👎');
        return;
    }

    // ------------------ M.sil-üye ------------------
    if (command === 'sil-üye' || command === 'silüye') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');
        }

        const target = message.mentions.members.first();
        const amount = parseInt(args[1]);

        if (!target) return message.reply('❌ Lütfen bir kullanıcı etiketleyin. Örnek: `M.sil-üye @kullanıcı 10`');
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('❌ Lütfen 1 ile 100 arasında silinecek miktar girin.');

        await message.delete().catch(() => {});

        const fetched = await message.channel.messages.fetch({ limit: 100 });
        const userMessages = fetched.filter(m => m.author.id === target.id).first(amount);

        if (userMessages.length === 0) {
            return message.channel.send('❌ Son 100 mesaj arasında bu kullanıcıya ait mesaj bulunamadı.').then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 3000);
            });
        }

        await message.channel.bulkDelete(userMessages, true);
        return message.channel.send(`🧹 **${target.user.username}** kullanıcısının **${userMessages.length}** adet mesajı silindi.`).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        });
    }

    // ==================== MODERASYON KOMUTLARI ====================

    // ------------------ M.sil ------------------
    if (command === 'sil' || command === 'clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('❌ Lütfen 1 ile 100 arasında silinecek bir mesaj sayısı girin.');
        }

        try {
            await message.channel.bulkDelete(amount + 1, true);

            const infoMsg = await message.channel.send(`🧹 **${amount}** adet mesaj silindi.`);
            setTimeout(() => infoMsg.delete().catch(() => {}), 3000);

        } catch (err) {
            console.error('Silme hatası:', err);
            message.channel.send('❌ 14 günden eski mesajlar silinemez veya yetkim yetersiz.').then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 3000);
            });
        }
    }

    // ------------------ M.yavaşmod ------------------
    if (command === 'yavaşmod' || command === 'slowmode') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ Bu komut için **Kanalları Yönet** yetkiniz olmalı.');
        }

        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0) {
            return message.reply('❌ Lütfen saniye cinsinden geçerli bir sayı girin (Kapatmak için `0`).');
        }

        await message.channel.setRateLimitPerUser(seconds);
        if (seconds === 0) {
            return message.reply('🚀 Kanaldaki yavaş mod kaldırıldı.');
        }
        return message.reply(`⏱️ Kanalın yavaş modu **${seconds}** saniye olarak ayarlandı.`);
    }

    // ------------------ M.kick ------------------
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.reply('❌ Bu komutu kullanmak için **Üyeleri At** yetkisine sahip olmalısınız.');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Lütfen sunucudan atılacak kullanıcıyı etiketleyin.');
        if (!member.kickable) return message.reply('❌ Bu kullanıcıyı sunucudan atmak için botun yetkisi yetersiz.');

        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        await member.kick(reason);
        return message.reply(`🚪 **${member.user.tag}** sunucudan atıldı. Sebep: *${reason}*`);
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

    // ------------------ M.unban ------------------
    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ Bu komut için **Üyeleri Yasakla** yetkisine sahip olmalısınız.');
        }

        const userId = args[0];
        if (!userId) return message.reply('❌ Lütfen banı kaldırılacak kullanıcının **ID numarasını** girin. Örnek: `M.unban 123456789012345678`');

        try {
            await message.guild.members.unban(userId);
            return message.reply(`🔓 **${userId}** ID'li kullanıcının yasağı kaldırıldı.`);
        } catch (err) {
            return message.reply('❌ Bu ID değerine sahip yasaklı bir kullanıcı bulunamadı.');
        }
    }

    // ------------------ M.mute ------------------
    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Bu komut için yetkiniz yok.');
        }

        const member = message.mentions.members.first();
        const durationInput = args[1];
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi.';

        if (!member) return message.reply('❌ Lütfen bir kullanıcı etiketleyin. Örnek: `M.mute @kullanıcı 10m Kural ihlali`');
        
        const durationMs = parseDuration(durationInput);
        if (!durationMs) {
            return message.reply('❌ Geçersiz süre formatı! Örnek: `1m` (1dk), `2h` (2saat), `1d` (1gün)');
        }

        if (!member.moderatable) {
            return message.reply('❌ Bu kullanıcıyı susturamıyorum! Bot rolünü kullanıcının rolünün **üstüne** taşıyın.');
        }

        try {
            await member.timeout(durationMs, reason);
            return message.reply(`🔇 **${member.user.tag}**, **${durationInput}** boyunca susturuldu. Sebep: *${reason}*`);
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

    // ------------------ M.yardım ------------------
    if (command === 'yardım' || command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🛠️ Mekan Bot - Komut Listesi')
            .setColor('#2F3136')
            .setDescription(`Tüm komutlar **${PREFIX}** ön eki ile çalışır.`)
            .addFields(
                { name: '✨ Genel & Profil', value: '`M.xp` - XP durumunuzu gösterir.\n`M.afk [sebep]` - AFK moduna geçmenizi sağlar.\n`M.profil [@kullanıcı]` - Kullanıcı detaylarını gösterir.\n`M.avatar [@kullanıcı]` - Profil resmini gösterir.\n`M.banner [@kullanıcı]` - Profil afişini gösterir.\n`M.sunucubilgi` - Sunucu istatistikleri.\n`M.ping` - Bot gecikmesini ölçer.' },
                { name: '🎮 Oyun & Eğlence', value: '`M.yazıtura` - Yazı-tura atar.\n`M.zar` - 1-6 arası zar atar.\n`M.8ball [soru]` - Sihirli 8ball sorunuzu yanıtlar.\n`M.düello @kullanıcı` - Etiketlenen kişiyle düello yapar.' },
                { name: '🛠️ Sunucu Araçları', value: '`M.duyuru [mesaj]` - Sunucuya duyuru atar.\n`M.oylama [soru]` - Oylama başlatır.\n`M.sil-üye @kullanıcı [miktar]` - Sadece o üyenin mesajlarını siler.' },
                { name: '🛡️ Moderasyon & Yönetim', value: '`M.sil [sayı]` - Mesajları topluca siler.\n`M.kick @kullanıcı` - Üyeyi sunucudan atar.\n`M.ban @kullanıcı` - Üyeyi yasaklar.\n`M.unban [ID]` - Yasaklı üyenin banını açar.\n`M.mute @kullanıcı [1m/1h]` - Susturur.\n`M.unmute @kullanıcı` - Susturmayı kaldırır.\n`M.yavaşmod [saniye]` - Yavaş mod ayarlar.\n`M.uyar @kullanıcı` - Uyarı verir.\n`M.uyarılar @kullanıcı` - Uyarı geçmişi.' }
            );

        return message.reply({ embeds: [embed] });
    }

    // ------------------ M.ping ------------------
    if (command === 'ping') {
        return message.reply(`🏓 Pong! Bot Gecikmesi: **${client.ws.ping}ms**`);
    }
});

client.login(TOKEN);
