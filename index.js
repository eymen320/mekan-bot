const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    PermissionsBitField, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
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
const afkData = new Map();

// Sistem Ayarları
const saAsSettings = new Map();
const kufurSettings = new Map();
const linkSettings = new Map();
const otoRolSettings = new Map();
const welcomeChannelSettings = new Map();
const sayacSettings = new Map();

// Renk Listesi Tanımları
const COLOR_ROLES = [
    { id: 'color_red', name: '🎨 Kırmızı', hex: '#E74C3C', label: 'Kırmızı', style: ButtonStyle.Danger },
    { id: 'color_blue', name: '🎨 Mavi', hex: '#3498DB', label: 'Mavi', style: ButtonStyle.Primary },
    { id: 'color_green', name: '🎨 Yeşil', hex: '#2ECC71', label: 'Yeşil', style: ButtonStyle.Success },
    { id: 'color_yellow', name: '🎨 Sarı', hex: '#F1C40F', label: 'Sarı', style: ButtonStyle.Secondary },
    { id: 'color_purple', name: '🎨 Mor', hex: '#9B59B6', label: 'Mor', style: ButtonStyle.Secondary },
    { id: 'color_pink', name: '🎨 Pembe', hex: '#E91E63', label: 'Pembe', style: ButtonStyle.Secondary },
    { id: 'color_orange', name: '🎨 Turuncu', hex: '#E67E22', label: 'Turuncu', style: ButtonStyle.Secondary },
    { id: 'color_black', name: '🎨 Siyah', hex: '#34495E', label: 'Siyah', style: ButtonStyle.Secondary }
];

// Yasaklı Küfür Listesi
const kufurList = ['amk', 'aq', 'amq', 'oç', 'oc', 'piç', 'pic', 'sik', 'yarrak', 'yarak', 'orospu', 'ibne', 'göt', 'sikim', 'sikik', 'yarram', 'sikem', 'orospucocugu'];

// 8ball Yanıt Listesi
const ballAnswers = [
    "Kesinlikle evet! 🎯",
    "Görünüşe göre öyle. 👍",
    "Şüphesiz! ✨",
    "Tam olarak anlayamadım, tekrar sor. 🔄",
    "Daha sonra tekrar sor. ⏳",
    "Şimdi söylemesem daha iyi. 🤐",
    "Pek sanmıyorum. ❌",
    "Yanıtım hayır. 👎",
    "Büyük ihtimalle hayır. 📉"
];

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

// XP ve Level Atlama Sistemi
function addXP(userId, amount) {
    let userData = xpData.get(userId) || { xp: 0, level: 1 };
    userData.xp += amount;
    
    let nextLevelXp = userData.level * 100;
    let leveledUp = false;

    if (userData.xp >= nextLevelXp) {
        userData.level += 1;
        userData.xp -= nextLevelXp;
        leveledUp = true;
    }
    
    xpData.set(userId, userData);
    return { userData, leveledUp };
}

// OTO-ROL & KARŞILAMA SİSTEMİ
client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;

    const roleId = otoRolSettings.get(guildId);
    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
            try {
                await member.roles.add(role);
            } catch (err) {
                console.error(`Oto-rol verilemedi!`);
            }
        }
    }

    const welcomeChannelId = welcomeChannelSettings.get(guildId);
    if (welcomeChannelId) {
        const channel = member.guild.channels.cache.get(welcomeChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('👋 Sunucuya Yeni Bir Üye Katıldı!')
                .setColor('#2ECC71')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setDescription(`Aramıza hoş geldin ${member}! Seninle birlikte **${member.guild.memberCount}** kişi olduk. 🎉`)
                .setFooter({ text: `Kullanıcı ID: ${member.id}` })
                .setTimestamp();
            channel.send({ embeds: [embed] });
        }
    }

    const sayac = sayacSettings.get(guildId);
    if (sayac) {
        const channel = member.guild.channels.cache.get(sayac.channelId);
        if (channel) {
            const remaining = sayac.target - member.guild.memberCount;
            if (remaining <= 0) {
                channel.send(`🎉 **Tebrikler!** Sunucumuz belirlenen **${sayac.target}** üye hedefine ulaştı!`);
            } else {
                channel.send(`📈 **${member.user.username}** sunucuya katıldı! **${sayac.target}** üye olmaya son **${remaining}** kişi kaldı! (${member.guild.memberCount}/${sayac.target})`);
            }
        }
    }
});

client.on('guildMemberRemove', async (member) => {
    const guildId = member.guild.id;
    const welcomeChannelId = welcomeChannelSettings.get(guildId);
    if (welcomeChannelId) {
        const channel = member.guild.channels.cache.get(welcomeChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('📤 Bir Üye Sunucudan Ayrıldı')
                .setColor('#E74C3C')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setDescription(`**${member.user.tag}** aramızdan ayrıldı. Kalan üye sayısı: **${member.guild.memberCount}**`)
                .setTimestamp();
            channel.send({ embeds: [embed] });
        }
    }
});

// BUTON TIKLAMA DİNLENMESİ (RENK ROLÜ SİSTEMİ)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, guild, member } = interaction;

    if (customId.startsWith('color_') || customId === 'reset_color') {
        await interaction.deferReply({ ephemeral: true });

        const botMember = await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.editReply({ content: '❌ Botun **Rolleri Yönet** yetkisi bulunmuyor!' });
        }

        // Kullanıcıdan mevcut tüm renk rollerini kaldır
        const colorRoleNames = COLOR_ROLES.map(c => c.name);
        const rolesToRemove = member.roles.cache.filter(role => colorRoleNames.includes(role.name));
        
        if (rolesToRemove.size > 0) {
            await member.roles.remove(rolesToRemove).catch(() => {});
        }

        if (customId === 'reset_color') {
            return interaction.editReply({ content: '🔄 İsim renginiz başarıyla sıfırlandı!' });
        }

        const selectedColor = COLOR_ROLES.find(c => c.id === customId);
        if (!selectedColor) return interaction.editReply({ content: '❌ Geçersiz renk seçimi.' });

        // Sunucuda renk rolü var mı kontrol et, yoksa otomatik oluştur
        let targetRole = guild.roles.cache.find(r => r.name === selectedColor.name);
        if (!targetRole) {
            try {
                targetRole = await guild.roles.create({
                    name: selectedColor.name,
                    color: selectedColor.hex,
                    reason: 'Mekan Bot Otomatik Renk Rolü Sistem'
                });
            } catch (err) {
                return interaction.editReply({ content: '❌ Renk rolü oluşturulurken bir hata oluştu. Botun rolünün en üstte olduğundan emin olun.' });
            }
        }

        // Botun rol seviyesi kontrolü
        if (botMember.roles.highest.position <= targetRole.position) {
            return interaction.editReply({ content: `❌ Botun rolü, verilmek istenen **${targetRole.name}** rolünün altında olduğu için bu rol verilemiyor!` });
        }

        try {
            await member.roles.add(targetRole);
            return interaction.editReply({ content: `🎨 İsminizin rengi başarıyla **${selectedColor.label}** olarak değiştirildi!` });
        } catch (err) {
            return interaction.editReply({ content: '❌ Rol verilirken bir hata oluştu.' });
        }
    }
});

// MESAJ DİNLENMESİ
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

    // KÜFÜR ENGEL
    if (kufurSettings.get(guildId) && !isStaff) {
        const contentLower = message.content.toLowerCase();
        const hasKufur = kufurList.some(word => contentLower.includes(word));
        if (hasKufur) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, bu sunucuda küfürlü kelimeler kullanmak yasaktır!`).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 4000);
            });
        }
    }

    // LİNK ENGEL
    if (linkSettings.get(guildId) && !isStaff) {
        const linkRegex = /(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)|(discord\.com\/invite\/[^\s]+)/i;
        if (linkRegex.test(message.content)) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, bu sunucuda link paylaşımı yapmak yasaktır!`).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 4000);
            });
        }
    }

    // SA-AS
    if (saAsSettings.get(guildId)) {
        const saWords = ['sa', 's.a', 's.a.', 'selam', 'selamun aleykum', 'selamün aleyküm'];
        if (saWords.includes(message.content.toLowerCase().trim())) {
            message.reply(`Aleykum Selam, Hoş Geldin! 👋`);
        }
    }

    // AFK KONTROLÜ
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

    // LEVEL VE XP SİSTEMİ
    const { userData, leveledUp } = addXP(message.author.id, Math.floor(Math.random() * 11) + 5);
    if (leveledUp) {
        const levelEmbed = new EmbedBuilder()
            .setTitle('🎉 Tebrikler! Level Atladın!')
            .setColor('#F1C40F')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setDescription(`Tebrikler ${message.author}! Başarıyla **Level ${userData.level}** seviyesine ulaştın! 🚀`);
        message.channel.send({ embeds: [levelEmbed] });
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ------------------ M.renk (RENK SEÇİM SİSTEMİ) ------------------
    if (command === 'renk' || command === 'renkler') {
        const embed = new EmbedBuilder()
            .setTitle('🎨 Kullanıcı İsim Rengi Seçimi')
            .setColor('#9B59B6')
            .setDescription('Aşağıdaki butonlara tıklayarak sunucudaki kullanıcı adınızın rengini değiştirebilirsiniz!')
            .setFooter({ text: 'Renk kaldırmak için "Rengi Sıfırla" butonunu kullanabilirsiniz.' });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('color_red').setLabel('Kırmızı').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('color_blue').setLabel('Mavi').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('color_green').setLabel('Yeşil').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('color_yellow').setLabel('Sarı').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('color_purple').setLabel('Mor').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('color_pink').setLabel('Pembe').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('color_orange').setLabel('Turuncu').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('color_black').setLabel('Siyah').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('reset_color').setLabel('Rengi Sıfırla').setStyle(ButtonStyle.Danger)
        );

        return message.reply({ embeds: [embed], components: [row1, row2] });
    }

    // ------------------ İSTATİSTİK VE BİLGİ KOMUTLARI ------------------
    if (command === 'istatistik' || command === 'i' || command === 'botbilgi') {
        const uptime = Math.floor(client.uptime / 1000);
        const embed = new EmbedBuilder()
            .setTitle('📊 Mekan Bot İstatistikleri')
            .setColor('#5865F2')
            .addFields(
                { name: '🌐 Hizmet Verilen Sunucu:', value: `${client.guilds.cache.size}`, inline: true },
                { name: '👥 Toplam Kullanıcı:', value: `${client.users.cache.size}`, inline: true },
                { name: '🏓 Gecikme (Ping):', value: `${client.ws.ping}ms`, inline: true },
                { name: '💾 RAM Kullanımı:', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
                { name: '⏰ Çalışma Süresi:', value: `${Math.floor(uptime / 60)} dakika ${uptime % 60} saniye`, inline: true }
            );
        return message.reply({ embeds: [embed] });
    }

    if (command === 'sunucu-bilgi' || command === 'sunucubilgi') {
        const guild = message.guild;
        const embed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name} Sunucu Bilgileri`)
            .setColor('#E74C3C')
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '🆔 Sunucu ID:', value: guild.id, inline: true },
                { name: '👑 Sunucu Sahibi:', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Üye Sayısı:', value: `${guild.memberCount}`, inline: true },
                { name: '💬 Kanal Sayısı:', value: `${guild.channels.cache.size}`, inline: true },
                { name: '🎭 Rol Sayısı:', value: `${guild.roles.cache.size}`, inline: true },
                { name: '📅 Kuruluş Tarihi:', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            );
        return message.reply({ embeds: [embed] });
    }

    if (command === 'yavaş-mod' || command === 'yavasmod' || command === 'slowmode') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ Bu komut için **Kanalları Yönet** yetkiniz olması gerekir.');
        }

        const sec = parseInt(args[0]);
        if (isNaN(sec) || sec < 0 || sec > 21600) {
            return message.reply('❌ Lütfen 0 ile 21600 (6 saat) arasında saniye cinsinden bir sayı girin. Örnek: `M.yavaş-mod 5`');
        }

        await message.channel.setRateLimitPerUser(sec);
        if (sec === 0) {
            return message.reply('🔓 Kanalın yavaş modu **kapatıldı**.');
        } else {
            return message.reply(`⏱️ Kanal yavaş modu **${sec} saniye** olarak ayarlandı.`);
        }
    }

    // ------------------ EĞLENCE & KULLANICI KOMUTLARI ------------------
    if (command === 'yazıtura' || command === 'yazi-tura') {
        const outcome = Math.random() < 0.5 ? '🪙 **YAZI** geldi!' : '🪙 **TURA** geldi!';
        return message.reply(outcome);
    }

    if (command === 'zar') {
        const roll = Math.floor(Math.random() * 6) + 1;
        return message.reply(`🎲 Attığın zar: **${roll}**`);
    }

    if (command === '8ball') {
        const question = args.join(' ');
        if (!question) return message.reply('❌ Lütfen sihirlı küreye sormak istediğin bir soru gir.');
        const randomAnswer = ballAnswers[Math.floor(Math.random() * ballAnswers.length)];
        const embed = new EmbedBuilder()
            .setTitle('🎱 Sihirli 8Ball')
            .setColor('#9B59B6')
            .addFields(
                { name: '❓ Soru:', value: question },
                { name: '💬 Cevap:', value: randomAnswer }
            );
        return message.reply({ embeds: [embed] });
    }

    if (command === 'xp' || command === 'level') {
        const user = message.mentions.users.first() || message.author;
        const data = xpData.get(user.id) || { xp: 0, level: 1 };
        const nextXp = data.level * 100;
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${user.username} - Level ve XP Durumu`)
            .setColor('#F1C40F')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '⭐ Seviye (Level):', value: `**${data.level}**`, inline: true },
                { name: '✨ XP:', value: `**${data.xp} / ${nextXp}**`, inline: true }
            );
        return message.reply({ embeds: [embed] });
    }

    if (command === 'afk') {
        const reason = args.join(' ') || 'Sebep belirtilmedi.';
        afkData.set(message.author.id, { reason, timestamp: Date.now() });
        return message.reply(`💤 **${message.author.username}**, başarıyla AFK moduna geçtin.\n📝 **Sebep:** ${reason}`);
    }

    if (command === 'avatar') {
        const user = message.mentions.users.first() || message.author;
        const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 1024 });
        const embed = new EmbedBuilder()
            .setTitle(`🖼️ ${user.username} kullanıcısının avatarı`)
            .setColor('#3498DB')
            .setImage(avatarUrl);
        return message.reply({ embeds: [embed] });
    }

    if (command === 'banner') {
        const user = message.mentions.users.first() || message.author;
        try {
            const fetchedUser = await client.users.fetch(user.id, { force: true });
            const bannerUrl = fetchedUser.bannerURL({ dynamic: true, size: 1024 });

            if (!bannerUrl) {
                return message.reply(`❌ **${user.username}** kullanıcısının herhangi bir bannerı bulunmuyor.`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎨 ${user.username} kullanıcısının bannerı`)
                .setColor('#E91E63')
                .setImage(bannerUrl);
            return message.reply({ embeds: [embed] });
        } catch (err) {
            return message.reply('❌ Banner alınırken bir hata oluştu.');
        }
    }

    if (command === 'profil') {
        const targetMember = message.mentions.members.first() || message.member;
        const targetUser = targetMember.user;
        const data = xpData.get(targetUser.id) || { xp: 0, level: 1 };

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${targetUser.username} - Kullanıcı Profili`)
            .setColor('#7289DA')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🆔 ID:', value: targetUser.id, inline: true },
                { name: '📅 Sunucuya Katılım:', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🚀 Discord Katılım:', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '⭐ Seviye / XP:', value: `Level **${data.level}** (${data.xp} XP)`, inline: true }
            );
        return message.reply({ embeds: [embed] });
    }

    // ------------------ SYSTEM SETTINGS ------------------
    if (command === 'hoşgeldin-kanal') {
        if (!isStaff) return message.reply('❌ Yetkiniz yetersiz.');

        const option = args[0]?.toLowerCase();
        if (option === 'sıfırla' || option === 'kapat') {
            welcomeChannelSettings.delete(guildId);
            return message.reply('🔄 **Hoş geldin kanalı başarıyla sıfırlandı ve sistem kapatıldı.**');
        }

        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('❌ Lütfen bir kanal etiketleyin veya kapatmak için `M.hoşgeldin-kanal sıfırla` yazın.');
        
        welcomeChannelSettings.set(guildId, ch.id);
        return message.reply(`👋 Hoş geldin kanalı ${ch} olarak ayarlandı.`);
    }

    if (command === 'sayaç') {
        if (!isStaff) return message.reply('❌ Yetkiniz yok.');

        const option = args[0]?.toLowerCase();
        if (option === 'sıfırla' || option === 'kapat') {
            sayacSettings.delete(guildId);
            return message.reply('🔄 **Sayaç sistemi sıfırlandı ve kapatıldı.**');
        }

        const target = parseInt(args[0]);
        const ch = message.mentions.channels.first();
        if (isNaN(target) || !ch) return message.reply('❌ Kullanım: `M.sayaç 100 #kanal` veya `M.sayaç sıfırla`');
        sayacSettings.set(guildId, { target, channelId: ch.id });
        return message.reply(`📊 Sayaç **${target}** olarak ayarlandı.`);
    }

    if (command === 'harici-bot' || command === 'haricibot') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ Bu komut için **Kanalları Yönet** yetkiniz olması gerekir.');
        }

        const action = args[0]?.toLowerCase();
        if (action !== 'kapat' && action !== 'aç' && action !== 'ac') {
            return message.reply('❌ Lütfen geçerli bir seçenek girin: `M.harici-bot kapat` veya `M.harici-bot aç`');
        }

        try {
            await message.guild.members.fetch();
            const botMembers = message.guild.members.cache.filter(m => m.user.bot && m.id !== client.user.id);

            if (botMembers.size === 0) {
                return message.reply('❌ Sunucuda Mekan Bot dışında başka harici bot bulunamadı.');
            }

            let count = 0;
            const allowSend = action === 'aç' || action === 'ac';

            for (const [id, botMember] of botMembers) {
                await message.channel.permissionOverwrites.edit(botMember, {
                    SendMessages: allowSend
                }).catch(() => {});
                count++;
            }

            if (action === 'kapat') {
                return message.reply(`🚫 Bu kanalda **${count}** adet harici botun mesaj göndermesi **engellendi**. Sadece Mekan Bot çalışacak!`);
            } else {
                return message.reply(`✅ Bu kanalda **${count}** adet harici botun mesaj gönderme izni **tekrar açıldı**.`);
            }

        } catch (err) {
            console.error(err);
            return message.reply('❌ İşlem sırasında bir hata oluştu.');
        }
    }

    if (command === 'oto-rol' || command === 'otorol') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply('❌ Bu komut için **Rolleri Yönet** yetkiniz olması gerekir.');
        }

        if (args[0]?.toLowerCase() === 'sıfırla') {
            otoRolSettings.delete(guildId);
            return message.reply('🔄 **Oto-Rol sistemi sıfırlandı ve kapatıldı.**');
        }

        const role = message.mentions.roles.first();
        if (!role) return message.reply('❌ Lütfen bir rol etiketleyin. Örnek: `M.oto-rol @Üye`');

        const botMember = message.guild.members.me;
        if (botMember.roles.highest.position <= role.position) {
            return message.reply(`❌ **Hata:** Botun rolü, vermeye çalıştığınız **${role.name}** rolünün **ALTINDA**!`);
        }

        otoRolSettings.set(guildId, role.id);
        return message.reply(`✅ **Oto-Rol başarıyla ayarlandı!** Yeni katılan üyelere **${role.name}** rolü verilecek.`);
    }

    // ------------------ MODERASYON ------------------
    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ Yetkiniz yok.');
        const member = message.mentions.members.first();
        const durationInput = args[1];
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi.';
        if (!member || !durationInput) return message.reply('❌ Kullanım: `M.mute @kullanıcı 10m Sebep`');
        const durationMs = parseDuration(durationInput);
        if (!durationMs) return message.reply('❌ Geçersiz süre formatı!');
        if (!member.moderatable) return message.reply('❌ Bot rolünü bu kullanıcının üstüne taşıyın.');

        try {
            await member.timeout(durationMs, reason);
            return message.reply(`🔇 **${member.user.tag}**, **${durationInput}** süreyle susturuldu.`);
        } catch (err) {
            return message.reply('❌ Susturma hatası.');
        }
    }

    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ Yetkiniz yok.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Kullanıcı etiketleyin.');
        if (!member.isCommunicationDisabled()) return message.reply('❌ Bu kullanıcı zaten mutesiz.');

        try {
            await member.timeout(null);
            return message.reply(`🔊 **${member.user.tag}** mutesi kaldırıldı!`);
        } catch (err) {
            return message.reply('❌ Mute kaldırılırken hata oluştu.');
        }
    }

    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Yetkiniz yok.');
        const userId = args[0];
        if (!userId) return message.reply('❌ Lütfen ID girin. Örnek: `M.unban 123456789012345678`');

        try {
            await message.guild.members.unban(userId);
            return message.reply(`🔓 **${userId}** ID'li kullanıcının banı kaldırıldı!`);
        } catch (err) {
            return message.reply('❌ Ban kaldırılırken hata oluştu.');
        }
    }

    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Yetkiniz yok.');
        const member = message.mentions.members.first();
        if (!member || !member.bannable) return message.reply('❌ Kullanıcı banlanamıyor.');
        const reason = args.slice(1).join(' ') || 'Sebep yok.';
        await member.ban({ reason });
        return message.reply(`✅ **${member.user.tag}** yasaklandı.`);
    }

    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ Yetkiniz yok.');
        const member = message.mentions.members.first();
        if (!member || !member.kickable) return message.reply('❌ Kullanıcı atılamıyor.');
        const reason = args.slice(1).join(' ') || 'Sebep yok.';
        await member.kick(reason);
        return message.reply(`🚪 **${member.user.tag}** atıldı.`);
    }

    if (command === 'sa-as') {
        if (!isStaff) return message.reply('❌ Yetkiniz yok.');
        const st = args[0]?.toLowerCase();
        if (st === 'aç') { saAsSettings.set(guildId, true); return message.reply('✅ SA-AS açıldı!'); }
        if (st === 'kapat') { saAsSettings.set(guildId, false); return message.reply('❌ SA-AS kapatıldı!'); }
    }

    if (command === 'küfür-engel') {
        if (!isStaff) return message.reply('❌ Yetkiniz yok.');
        const st = args[0]?.toLowerCase();
        if (st === 'aç') { kufurSettings.set(guildId, true); return message.reply('🛡️ Küfür engeli açıldı!'); }
        if (st === 'kapat') { kufurSettings.set(guildId, false); return message.reply('❌ Küfür engeli kapatıldı!'); }
    }

    if (command === 'link-engel') {
        if (!isStaff) return message.reply('❌ Yetkiniz yok.');
        const st = args[0]?.toLowerCase();
        if (st === 'aç') { linkSettings.set(guildId, true); return message.reply('🔗 Link engeli açıldı!'); }
        if (st === 'kapat') { linkSettings.set(guildId, false); return message.reply('❌ Link engeli kapatıldı!'); }
    }

    if (command === 'sil') {
        if (!isStaff) return message.reply('❌ Yetkiniz yok.');
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('❌ 1-100 arası sayı girin.');
        await message.channel.bulkDelete(amount + 1, true).catch(() => {});
        return message.channel.send(`🧹 **${amount}** mesaj silindi.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
    }

    if (command === 'yardım' || command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🛠️ Mekan Bot Komutları')
            .setColor('#5865F2')
            .addFields(
                { name: '🎨 İsim Rengi', value: '`M.renk` - İsim renginizi değiştirebileceğiniz butonlu menüyü açar.' },
                { name: '🎉 Eğlence & Kullanıcı', value: '`M.yazıtura` | `M.zar` | `M.8ball [soru]`\n`M.xp` | `M.afk [sebep]` | `M.avatar` | `M.banner` | `M.profil`' },
                { name: '🤖 Bot & Sunucu Bilgi', value: '`M.istatistik` - Bot durumunu gösterir.\n`M.sunucu-bilgi` - Sunucu bilgilerini gösterir.\n`M.harici-bot kapat/aç` - Diğer bot mesajlarını engeller.' },
                { name: '🛡️ Moderasyon', value: '`M.mute @kullanıcı 10m` | `M.unmute @kullanıcı`\n`M.ban @kullanıcı` | `M.unban [ID]`\n`M.kick @kullanıcı` | `M.sil [sayı]`\n`M.yavaş-mod [saniye]`' },
                { name: '⚙️ Sistemler', value: '`M.oto-rol @rol` (Sıfırlama: `M.oto-rol sıfırla`)\n`M.hoşgeldin-kanal #kanal` (Sıfırlama: `M.hoşgeldin-kanal sıfırla`)\n`M.sayaç [hedef] #kanal` (Sıfırlama: `M.sayaç sıfırla`)\n`M.sa-as aç/kapat` | `M.küfür-engel aç/kapat` | `M.link-engel aç/kapat`' }
            );
        return message.reply({ embeds: [embed] });
    }

    if (command === 'ping') return message.reply(`🏓 Pong! **${client.ws.ping}ms**`);
});

client.login(TOKEN);
