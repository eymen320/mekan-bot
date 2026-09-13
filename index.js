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

// Geçici Veri Depoları (Bellek İçi Ayarlar)
const xpData = new Map();
const warnings = new Map();
const afkData = new Map();

// Sistem Ayarları
const saAsSettings = new Map();       // guildId -> boolean
const kufurSettings = new Map();      // guildId -> boolean
const linkSettings = new Map();       // guildId -> boolean
const otoRolSettings = new Map();    // guildId -> roleId
const welcomeChannelSettings = new Map(); // guildId -> channelId
const sayacSettings = new Map();     // guildId -> { target: number, channelId: string }

// Yasaklı Küfür Listesi
const kufurList = ['amk', 'aq', 'amq', 'oç', 'oc', 'piç', 'pic', 'sik', 'yarrak', 'yarak', 'orospu', 'ibne', 'göt'];

// İngilizce Süre Dönüştürücü Fonksiyon
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

// ------------------ SUNUCUYA YENİ ÜYE KATILDIĞINDA (OTO-ROL, HOŞ GELDİN, SAYAÇ) ------------------
client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;

    // 1. Oto-Rol Sistemi
    const roleId = otoRolSettings.get(guildId);
    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
            member.roles.add(role).catch(() => console.error('Oto-rol verilemedi, yetki yetersiz olabilir.'));
        }
    }

    // 2. Karşılama (Hoş Geldin) Mesajı
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

    // 3. Sayaç Sistemi
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

// ------------------ SUNUCUDAN BİRİ AYRILDIĞINDA (GÜLE GÜLE & SAYAÇ) ------------------
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

// ------------------ MESAJ DİNLEYİCİSİ & KONTROLLER ------------------
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

    // --- KÜFÜR ENGEL KONTROLÜ ---
    if (kufurSettings.get(guildId) && !isStaff) {
        const contentLower = message.content.toLowerCase();
        const hasKufur = kufurList.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(contentLower);
        });

        if (hasKufur) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, bu sunucuda küfürlü kelimeler kullanmak yasaktır!`).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 4000);
            });
        }
    }

    // --- LİNK ENGEL KONTROLÜ ---
    if (linkSettings.get(guildId) && !isStaff) {
        const linkRegex = /(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)|(discord\.com\/invite\/[^\s]+)/i;
        if (linkRegex.test(message.content)) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, bu sunucuda reklam/link paylaşımı yapmak yasaktır!`).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 4000);
            });
        }
    }

    // --- SA-AS KONTROLÜ ---
    if (saAsSettings.get(guildId)) {
        const saWords = ['sa', 's.a', 's.a.', 'selam', 'selamun aleykum', 'selamün aleyküm'];
        if (saWords.includes(message.content.toLowerCase().trim())) {
            message.reply(`Aleykum Selam, Hoş Geldin! 👋`);
        }
    }

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

    // Her mesajda XP kazandır
    const randomXP = Math.floor(Math.random() * 11) + 5;
    addXP(message.author.id, randomXP);

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ==================== GÜVENLİK & KORUMA KOMUTLARI ====================

    // ------------------ M.sa-as ------------------
    if (command === 'sa-as' || command === 'saas') {
        if (!isStaff) return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');

        const status = args[0]?.toLowerCase();
        if (status === 'aç' || status === 'ac') {
            saAsSettings.set(guildId, true);
            return message.reply('✅ **SA-AS sistemi başarıyla açıldı!** Artık selam verenlere otomatik cevap verilecek.');
        } else if (status === 'kapat') {
            saAsSettings.set(guildId, false);
            return message.reply('❌ **SA-AS sistemi kapatıldı.**');
        } else {
            return message.reply('❌ Lütfen geçerli bir seçenek girin: `M.sa-as aç` veya `M.sa-as kapat`');
        }
    }

    // ------------------ M.küfür-engel ------------------
    if (command === 'küfür-engel' || command === 'kufur-engel') {
        if (!isStaff) return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');

        const status = args[0]?.toLowerCase();
        if (status === 'aç' || status === 'ac') {
            kufurSettings.set(guildId, true);
            return message.reply('🛡️ **Küfür Engel sistemi açıldı!** Küfürlü mesajlar otomatik silinecektir.');
        } else if (status === 'kapat') {
            kufurSettings.set(guildId, false);
            return message.reply('❌ **Küfür Engel sistemi kapatıldı.**');
        } else {
            return message.reply('❌ Kullanım: `M.küfür-engel aç` veya `M.küfür-engel kapat`');
        }
    }

    // ------------------ M.link-engel ------------------
    if (command === 'link-engel' || command === 'linkengel') {
        if (!isStaff) return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');

        const status = args[0]?.toLowerCase();
        if (status === 'aç' || status === 'ac') {
            linkSettings.set(guildId, true);
            return message.reply('🔗 **Link Engel sistemi açıldı!** Yetkisiz kullanıcıların link atması engellenecektir.');
        } else if (status === 'kapat') {
            linkSettings.set(guildId, false);
            return message.reply('❌ **Link Engel sistemi kapatıldı.**');
        } else {
            return message.reply('❌ Kullanım: `M.link-engel aç` veya `M.link-engel kapat`');
        }
    }

    // ------------------ M.oto-rol ------------------
    if (command === 'oto-rol' || command === 'otorol') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply('❌ Bu komut için **Rolleri Yönet** yetkiniz olması gerekir.');
        }

        if (args[0]?.toLowerCase() === 'sıfırla') {
            otoRolSettings.delete(guildId);
            return message.reply('🔄 **Oto-Rol sistemi sıfırlandı ve kapatıldı.**');
        }

        const role = message.mentions.roles.first();
        if (!role) return message.reply('❌ Lütfen bir rol etiketleyin. Örnek: `M.oto-rol @Üye` veya kapatmak için `M.oto-rol sıfırla`');

        otoRolSettings.set(guildId, role.id);
        return message.reply(`✅ **Oto-Rol başarıyla ayarlandı!** Yeni katılan üyelere ${role} rolü verilecek.`);
    }

    // ------------------ M.hoşgeldin-kanal ------------------
    if (command === 'hoşgeldin-kanal' || command === 'hosgeldin-kanal') {
        if (!isStaff) return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');

        if (args[0]?.toLowerCase() === 'sıfırla') {
            welcomeChannelSettings.delete(guildId);
            return message.reply('🔄 **Hoş geldin kanalı sıfırlandı ve kapatıldı.**');
        }

        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Lütfen mesajların atılacağı kanalı etiketleyin. Örnek: `M.hoşgeldin-kanal #hoşgeldiniz`');

        welcomeChannelSettings.set(guildId, channel.id);
        return message.reply(`👋 **Hoş geldin kanalı başarıyla ${channel} olarak ayarlandı!**`);
    }

    // ------------------ M.sayaç ------------------
    if (command === 'sayaç' || command === 'sayac') {
        if (!isStaff) return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');

        if (args[0]?.toLowerCase() === 'sıfırla') {
            sayacSettings.delete(guildId);
            return message.reply('🔄 **Sayaç sistemi sıfırlandı.**');
        }

        const target = parseInt(args[0]);
        const channel = message.mentions.channels.first();

        if (isNaN(target) || !channel) {
            return message.reply('❌ Lütfen bir hedef sayı ve kanal belirtin. Örnek: `M.sayaç 100 #sayaç-kanalı`');
        }

        if (target <= message.guild.memberCount) {
            return message.reply(`❌ Hedef üye sayısı mevcut üye sayısından (**${message.guild.memberCount}**) büyük olmalıdır!`);
        }

        sayacSettings.set(guildId, { target, channelId: channel.id });
        return message.reply(`📊 **Sayaç başarıyla ayarlandı!** Hedef: **${target}** üye | Kanal: ${channel}`);
    }

    // ==================== DİĞER KOMUTLAR ====================

    // ------------------ M.afk ------------------
    if (command === 'afk') {
        const reason = args.join(' ') || 'Sebep belirtilmedi.';
        afkData.set(message.author.id, { reason, timestamp: Date.now() });
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
            'Evet, kesinlikle! ✨', 'Buna hiç şüphe yok. 👍', 'Büyük ihtimalle evet. 😊',
            'Görünüşe göre evet. 🔮', 'Tam olarak emin değilim, tekrar sor. 🤔',
            'Daha sonra tekrar dene. ⏳', 'Şu an tahmin edemiyorum. 🌫️',
            'Pek sanmıyorum. 👎', 'Cevabım hayır. ❌', 'Şüphen bile olmasın: Hayır! 🙅'
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

    // ------------------ M.duyuru ------------------
    if (command === 'duyuru') {
        if (!isStaff) return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');
        const text = args.join(' ');
        if (!text) return message.reply('❌ Lütfen duyuru metnini yazın.');

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
        if (!isStaff) return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');
        const question = args.join(' ');
        if (!question) return message.reply('❌ Lütfen oylama konusunu belirtin.');

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
        if (!isStaff) return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');

        const target = message.mentions.members.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('❌ Kullanım: `M.sil-üye @kullanıcı 10`');
        }

        await message.delete().catch(() => {});

        const fetched = await message.channel.messages.fetch({ limit: 100 });
        const userMessages = fetched.filter(m => m.author.id === target.id).first(amount);

        if (userMessages.length === 0) {
            return message.channel.send('❌ Kullanıcıya ait mesaj bulunamadı.').then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 3000);
            });
        }

        await message.channel.bulkDelete(userMessages, true);
        return message.channel.send(`🧹 **${target.user.username}** kullanıcısının **${userMessages.length}** adet mesajı silindi.`).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        });
    }

    // ------------------ M.sil ------------------
    if (command === 'sil' || command === 'clear') {
        if (!isStaff) return message.reply('❌ Bu komut için **Mesajları Yönet** yetkiniz olması gerekir.');

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('❌ Lütfen 1 ile 100 arasında bir sayı girin.');
        }

        try {
            await message.channel.bulkDelete(amount + 1, true);
            const infoMsg = await message.channel.send(`🧹 **${amount}** adet mesaj silindi.`);
            setTimeout(() => infoMsg.delete().catch(() => {}), 3000);
        } catch (err) {
            message.channel.send('❌ 14 günden eski mesajlar silinemez.').then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 3000);
            });
        }
    }

    // ------------------ M.kick / M.ban / M.unban / M.mute / M.unmute / M.uyar ------------------
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ Yetkiniz yetersiz.');
        const member = message.mentions.members.first();
        if (!member || !member.kickable) return message.reply('❌ Kullanıcı atılamıyor.');
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        await member.kick(reason);
        return message.reply(`🚪 **${member.user.tag}** atıldı. Sebep: *${reason}*`);
    }

    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Yetkiniz yetersiz.');
        const member = message.mentions.members.first();
        if (!member || !member.bannable) return message.reply('❌ Kullanıcı yasaklanamıyor.');
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        await member.ban({ reason });
        return message.reply(`✅ **${member.user.tag}** yasaklandı. Sebep: *${reason}*`);
    }

    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ Yetkiniz yetersiz.');
        const member = message.mentions.members.first();
        const durationMs = parseDuration(args[1]);
        if (!member || !durationMs) return message.reply('❌ Kullanım: `M.mute @kullanıcı 10m Sebep`');
        await member.timeout(durationMs, args.slice(2).join(' ') || 'Sebep yok.');
        return message.reply(`🔇 **${member.user.tag}** susturuldu.`);
    }

    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ Yetkiniz yetersiz.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Kullanıcı etiketleyin.');
        await member.timeout(null);
        return message.reply(`🔊 **${member.user.tag}** susturulması kaldırıldı.`);
    }

    // ------------------ M.yardım ------------------
    if (command === 'yardım' || command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🛠️ Mekan Bot - Güncel Komut Listesi')
            .setColor('#2F3136')
            .setDescription(`Tüm komutlar **${PREFIX}** ön eki ile çalışır.`)
            .addFields(
                { name: '🛡️ Güvenlik & Sistemler', value: '`M.sa-as [aç/kapat]` - Otomatik selam yanıtı.\n`M.küfür-engel [aç/kapat]` - Küfür filtresi.\n`M.link-engel [aç/kapat]` - Reklam ve link engelleyici.\n`M.oto-rol [@rol/sıfırla]` - Oto rol verilmesini sağlar.' },
                { name: '👋 Karşılama & Sayaç', value: '`M.hoşgeldin-kanal [#kanal/sıfırla]` - Karşılama kanalı.\n`M.sayaç [hedef] [#kanal]` - Üye hedef sayacı ayarlar.' },
                { name: '🎮 Eğlence & Kullanıcı', value: '`M.yazıtura` - Yazı-tura atar.\n`M.zar` - Zar atar.\n`M.8ball [soru]` - Sihirli küreye soru sorar.\n`M.xp` - XP durumunu gösterir.\n`M.afk` - AFK moduna geçer.\n`M.avatar` / `M.banner` / `M.profil` - Profil araçları.' },
                { name: '⚙️ Moderasyon & Yönetim', value: '`M.sil [sayı]` - Mesajları topluca siler.\n`M.sil-üye @kullanıcı [miktar]` - Üyenin mesajlarını siler.\n`M.duyuru [mesaj]` - Duyuru kartı atar.\n`M.oylama [soru]` - Oylama başlatır.\n`M.kick` / `M.ban` / `M.mute` - Sunucu koruma komutları.' }
            );

        return message.reply({ embeds: [embed] });
    }

    // ------------------ M.ping ------------------
    if (command === 'ping') {
        return message.reply(`🏓 Pong! Bot Gecikmesi: **${client.ws.ping}ms**`);
    }
});

client.login(TOKEN);
