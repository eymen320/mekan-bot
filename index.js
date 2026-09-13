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

// Sistem Ayarları
const saAsSettings = new Map();
const kufurSettings = new Map();
const linkSettings = new Map();
const otoRolSettings = new Map();
const welcomeChannelSettings = new Map();
const sayacSettings = new Map();

// Yasaklı Küfür Listesi
const kufurList = ['amk', 'aq', 'amq', 'oç', 'oc', 'piç', 'pic', 'sik', 'yarrak', 'yarak', 'orospu', 'ibne', 'göt'];

// Süre Dönüştürücü Fonksiyon (1m, 1h, 1d)
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

// XP Sistemi
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

// ------------------ OTO-ROL & KARŞILAMA SİSTEMİ ------------------
client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;

    // 1. Oto-Rol Sistemi
    const roleId = otoRolSettings.get(guildId);
    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
            try {
                await member.roles.add(role);
            } catch (err) {
                console.error(`Oto-rol verilemedi! Botun rolü (${role.name}) rolünün altında olabilir.`);
            }
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

// ------------------ MESAJ VE KOMUT DİNLENMESİ ------------------
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

    // --- KÜFÜR ENGEL ---
    if (kufurSettings.get(guildId) && !isStaff) {
        const contentLower = message.content.toLowerCase();
        const hasKufur = kufurList.some(word => new RegExp(`\\b${word}\\b`, 'i').test(contentLower));
        if (hasKufur) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, bu sunucuda küfürlü kelimeler kullanmak yasaktır!`).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 4000);
            });
        }
    }

    // --- LİNK ENGEL ---
    if (linkSettings.get(guildId) && !isStaff) {
        const linkRegex = /(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)|(discord\.com\/invite\/[^\s]+)/i;
        if (linkRegex.test(message.content)) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, bu sunucuda link paylaşımı yapmak yasaktır!`).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 4000);
            });
        }
    }

    // --- SA-AS ---
    if (saAsSettings.get(guildId)) {
        const saWords = ['sa', 's.a', 's.a.', 'selam', 'selamun aleykum', 'selamün aleyküm'];
        if (saWords.includes(message.content.toLowerCase().trim())) {
            message.reply(`Aleykum Selam, Hoş Geldin! 👋`);
        }
    }

    // --- AFK KONTROLÜ ---
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

    addXP(message.author.id, Math.floor(Math.random() * 11) + 5);

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

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
        if (!role) return message.reply('❌ Lütfen bir rol etiketleyin. Örnek: `M.oto-rol @Üye`');

        // Botun Rolü Etiketlenen Rolün Üstünde mi Kontrol Et
        const botMember = message.guild.members.me;
        if (botMember.roles.highest.position <= role.position) {
            return message.reply(`❌ **Hata:** Botun rolü, vermeye çalıştığınız **${role.name}** rolünün **ALTINDA**! Lütfen Sunucu Ayarları > Roller kısmından Bot rolünü bu rolün üstüne sürükleyin.`);
        }

        otoRolSettings.set(guildId, role.id);
        return message.reply(`✅ **Oto-Rol başarıyla ayarlandı!** Yeni katılan üyelere **${role.name}** rolü verilecek.`);
    }

    // ------------------ M.mute ------------------
    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Bu komut için yetkiniz yok.');
        }

        const member = message.mentions.members.first();
        const durationInput = args[1];
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi.';

        if (!member || !durationInput) {
            return message.reply('❌ Kullanım: `M.mute @kullanıcı 10m Sebep` (Örnek süreler: 1m, 2h, 1d)');
        }

        const durationMs = parseDuration(durationInput);
        if (!durationMs) return message.reply('❌ Geçersiz süre! Geçerli formatlar: `10m` (dakika), `2h` (saat), `1d` (gün)');

        if (!member.moderatable) {
            return message.reply('❌ **Bu kullanıcıyı susturamıyorum!** Botun rolü, susturmaya çalıştığınız kullanıcının/modaratörün rolünden **daha aşağıda**. Bot rolünü Roller kısmından en üste taşıyın!');
        }

        try {
            await member.timeout(durationMs, reason);
            return message.reply(`🔇 **${member.user.tag}**, **${durationInput}** süreyle susturuldu. Sebep: *${reason}*`);
        } catch (err) {
            return message.reply('❌ Susturma işlemi sırasında hata oluştu.');
        }
    }

    // ------------------ M.unmute (MUTE KALDIRMA) ------------------
    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Bu komut için yetkiniz yok.');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Lütfen mutesi kaldırılacak kullanıcıyı etiketleyin. Örnek: `M.unmute @kullanıcı`');

        if (!member.isCommunicationDisabled()) {
            return message.reply('❌ Bu kullanıcı zaten susturulmamış (mutesiz).');
        }

        try {
            await member.timeout(null);
            return message.reply(`🔊 **${member.user.tag}** kullanıcısının susturulması (mutesi) kaldırıldı!`);
        } catch (err) {
            return message.reply('❌ Kullanıcının mutesi kaldırılırken hata oluştu. Bot yetkisini kontrol edin.');
        }
    }

    // ------------------ M.unban (BAN KALDIRMA) ------------------
    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ Bu komut için **Üyeleri Yasakla** yetkiniz olması gerekir.');
        }

        const userId = args[0];
        if (!userId) return message.reply('❌ Lütfen banı kaldırılacak kişinin **ID numarasını** yazın. Örnek: `M.unban 123456789012345678`');

        try {
            const bans = await message.guild.bans.fetch();
            const bannedUser = bans.get(userId);

            if (!bannedUser) {
                return message.reply('❌ Bu ID numarasına sahip yasaklanmış (banlı) bir kullanıcı bulunamadı.');
            }

            await message.guild.members.unban(userId);
            return message.reply(`🔓 **${bannedUser.user.tag}** kullanıcısının banı başarıyla kaldırıldı!`);
        } catch (err) {
            return message.reply('❌ Ban kaldırılırken bir hata oluştu. ID numarasının doğru olduğundan ve botun ban kaldırma yetkisinin olduğundan emin olun.');
        }
    }

    // ------------------ M.ban ------------------
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Yetkiniz yok.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Lütfen bir kullanıcı etiketleyin.');
        if (!member.bannable) return message.reply('❌ Bu kullanıcıyı banlamak için botun rolünün kullanıcının üstünde olması gerekir.');
        
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        await member.ban({ reason });
        return message.reply(`✅ **${member.user.tag}** yasaklandı. Sebep: *${reason}*`);
    }

    // ------------------ M.kick ------------------
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ Yetkiniz yok.');
        const member = message.mentions.members.first();
        if (!member || !member.kickable) return message.reply('❌ Kullanıcı atılamıyor.');
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        await member.kick(reason);
        return message.reply(`🚪 **${member.user.tag}** atıldı. Sebep: *${reason}*`);
    }

    // ------------------ M.sa-as / M.küfür-engel / M.link-engel ------------------
    if (command === 'sa-as') {
        if (!isStaff) return message.reply('❌ Yetkiniz yetersiz.');
        const st = args[0]?.toLowerCase();
        if (st === 'aç') { saAsSettings.set(guildId, true); return message.reply('✅ SA-AS sistemi açıldı!'); }
        if (st === 'kapat') { saAsSettings.set(guildId, false); return message.reply('❌ SA-AS sistemi kapatıldı!'); }
    }

    if (command === 'küfür-engel') {
        if (!isStaff) return message.reply('❌ Yetkiniz yetersiz.');
        const st = args[0]?.toLowerCase();
        if (st === 'aç') { kufurSettings.set(guildId, true); return message.reply('🛡️ Küfür engeli açıldı!'); }
        if (st === 'kapat') { kufurSettings.set(guildId, false); return message.reply('❌ Küfür engeli kapatıldı!'); }
    }

    if (command === 'link-engel') {
        if (!isStaff) return message.reply('❌ Yetkiniz yetersiz.');
        const st = args[0]?.toLowerCase();
        if (st === 'aç') { linkSettings.set(guildId, true); return message.reply('🔗 Link engeli açıldı!'); }
        if (st === 'kapat') { linkSettings.set(guildId, false); return message.reply('❌ Link engeli kapatıldı!'); }
    }

    // ------------------ M.hoşgeldin-kanal & M.sayaç ------------------
    if (command === 'hoşgeldin-kanal') {
        if (!isStaff) return message.reply('❌ Yetkiniz yetersiz.');
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('❌ Kanal etiketleyin.');
        welcomeChannelSettings.set(guildId, ch.id);
        return message.reply(`👋 Hoş geldin kanalı ${ch} yapıldı.`);
    }

    if (command === 'sayaç') {
        if (!isStaff) return message.reply('❌ Yetkiniz yetersiz.');
        const target = parseInt(args[0]);
        const ch = message.mentions.channels.first();
        if (isNaN(target) || !ch) return message.reply('❌ Kullanım: `M.sayaç 100 #kanal`');
        sayacSettings.set(guildId, { target, channelId: ch.id });
        return message.reply(`📊 Sayaç **${target}** olarak ayarlandı.`);
    }

    // ------------------ DİĞER KOMUTLAR ------------------
    if (command === 'sil') {
        if (!isStaff) return message.reply('❌ Yetkiniz yetersiz.');
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
                { name: '🛡️ Moderasyon', value: '`M.mute @kullanıcı 10m [sebep]`\n`M.unmute @kullanıcı`\n`M.ban @kullanıcı`\n`M.unban [ID]`\n`M.kick @kullanıcı`\n`M.sil [sayı]`' },
                { name: '⚙️ Sistemler', value: '`M.oto-rol @rol`\n`M.sa-as aç/kapat`\n`M.küfür-engel aç/kapat`\n`M.link-engel aç/kapat`\n`M.hoşgeldin-kanal #kanal`\n`M.sayaç [hedef] #kanal`' }
            );
        return message.reply({ embeds: [embed] });
    }

    if (command === 'ping') return message.reply(`🏓 Pong! **${client.ws.ping}ms**`);
});

client.login(TOKEN);
