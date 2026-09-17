const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// Web Sunucusu (Render 7/24 Kesintisiz Aktif Tutma)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Mekan Bot 7/24 Aktif!'));
app.listen(PORT, () => console.log(`Web sunucusu ${PORT} portunda dinleniyor.`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// Sistem Hafızaları (Bellek İçi Veritabanı)
const userXP = new Map();
const afkUsers = new Map();
const guildSettings = new Map();

const getSettings = (guildId) => {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      saAs: true,
      kufurEngel: false,
      linkEngel: false,
      hariciBot: false,
      otoRol: null,
      hosgeldinKanal: null,
      sayacHedef: null,
      sayacKanal: null
    });
  }
  return guildSettings.get(guildId);
};

client.once('ready', () => console.log(`Bot aktif! ${client.user.tag} olarak giriş yapıldı.`));

// OTO-ROL & HOŞGELDİN / SAYAÇ SİSTEMİ
client.on('guildMemberAdd', async (member) => {
  const set = getSettings(member.guild.id);
  
  if (set.otoRol) {
    const role = member.guild.roles.cache.get(set.otoRol);
    if (role) member.roles.add(role).catch(() => {});
  }

  if (set.hosgeldinKanal) {
    const channel = member.guild.channels.cache.get(set.hosgeldinKanal);
    if (channel) channel.send(`👋 Hoş geldin **${member.user.username}**! Sunucumuz ${member.guild.memberCount} kişiye ulaştı.`);
  }

  if (set.sayacKanal && set.sayacHedef) {
    const channel = member.guild.channels.cache.get(set.sayacKanal);
    const kalan = set.sayacHedef - member.guild.memberCount;
    if (channel) channel.send(`📊 **${member.user.username}** katıldı! Hedefe son **${kalan}** üye kaldı.`);
  }
});

// RENK BUTONLARI ETKİLEŞİMİ
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith('color_')) {
    const colorName = interaction.customId.replace('color_', '');
    let role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === colorName.toLowerCase());
    
    if (!role) {
      return interaction.reply({ content: `❌ **${colorName}** adında bir rol bulunamadı! Lütfen önce sunucuda bu isimde bir rol oluşturun.`, ephemeral: true });
    }
    await interaction.member.roles.add(role).catch(() => {});
    return interaction.reply({ content: `🎨 **${role.name}** rengi hesabınıza tanımlandı!`, ephemeral: true });
  }
});

// MESAJ & KOMUT KONTROL
client.on('messageCreate', async (message) => {
  if (!message.guild) return;
  const set = getSettings(message.guild.id);

  // HARİCİ BOT ENGEL
  if (message.author.bot) {
    if (set.hariciBot && message.author.id !== client.user.id) {
      message.delete().catch(() => {});
    }
    return;
  }

  // AFK KONTROLÜ
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    message.reply(`👋 Hoş geldin **${message.author.username}**, AFK modundan çıkarıldın.`);
  }
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(u => {
      if (afkUsers.has(u.id)) {
        message.reply(`⚠️ **${u.username}** şu an AFK. Sebep: *${afkUsers.get(u.id)}*`);
      }
    });
  }

  // KÜFÜR ENGEL
  if (set.kufurEngel) {
    const kufurler = ['amk', 'aq', 'sik', 'piç', 'orospu', 'yarrak'];
    if (kufurler.some(w => message.content.toLowerCase().includes(w))) {
      message.delete().catch(() => {});
      return message.channel.send(`⚠️ ${message.author}, bu sunucuda küfür engeli aktif!`).then(m => setTimeout(() => m.delete(), 3000));
    }
  }

  // LİNK ENGEL
  if (set.linkEngel) {
    if (/(https?:\/\/|www\.)[^\s]+/gi.test(message.content)) {
      message.delete().catch(() => {});
      return message.channel.send(`⚠️ ${message.author}, bu sunucuda link reklam engeli aktif!`).then(m => setTimeout(() => m.delete(), 3000));
    }
  }

  // SA-AS SİSTEMİ
  if (set.saAs) {
    const msg = message.content.toLowerCase();
    if (['sa', 's.a', 'selam', 'selamunaleykum'].includes(msg)) {
      message.reply(`Aleyküm Selam **${message.author.username}**, Hoş Geldin! 👋`);
    }
  }

  // XP SİSTEMİ
  const userId = message.author.id;
  userXP.set(userId, (userXP.get(userId) || 0) + 5);

  // PREFIX KONTROL (M.)
  const prefix = 'M.';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ==================== YARDIM MENÜSÜ ====================

  if (command === 'yardım' || command === 'yardim' || command === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🛠️ Mekan Bot - Komut Menüsü')
      .setDescription('Botun tüm aktif komutları aşağıda kategorilenmiştir:')
      .addFields(
        { name: '🎨 Rol Menüsü', value: '`M.renk` - İsim rengi seçme menüsü' },
        { name: '🎲 Eğlence & Kullanıcı', value: '`M.yazıtura` | `M.zar` | `M.8ball [soru]`\n`M.xp` | `M.afk [sebep]` | `M.avatar` | `M.banner` | `M.profil`' },
        { name: '🤖 Bot & Sunucu Bilgi', value: '`M.istatistik` - Bot durumu\n`M.sunucu-bilgi` - Sunucu bilgileri\n`M.harici-bot aç/kapat` - Diğer botları engeller' },
        { name: '🛡️ Moderasyon', value: '`M.mute @üye [dk]` | `M.unmute @üye`\n`M.ban @üye` | `M.unban [ID]`\n`M.kick @üye` | `M.sil [sayı]`\n`M.yavaş-mod [saniye]`' },
        { name: '⚙️ Sistemler', value: '`M.oto-rol @rol` (Sıfırlama: `M.oto-rol sıfırla`)\n`M.hoşgeldin-kanal #kanal` (Sıfırlama: `M.hoşgeldin-kanal sıfırla`)\n`M.sayaç [hedef] #kanal` (Sıfırlama: `M.sayaç sıfırla`)\n`M.sa-as aç/kapat` | `M.küfür-engel aç/kapat` | `M.link-engel aç/kapat`' }
      )
      .setFooter({ text: 'Mekan Bot | M.yardım' });

    return message.reply({ embeds: [embed] });
  }

  // ==================== MENÜLER & BUTON ====================

  if (command === 'renk') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('color_Kırmızı').setLabel('🔴 Kırmızı').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('color_Mavi').setLabel('🔵 Mavi').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('color_Yeşil').setLabel('🟢 Yeşil').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('color_Sarı').setLabel('🟡 Sarı').setStyle(ButtonStyle.Warning)
    );
    return message.reply({ content: '🎨 **Aşağıdaki butonlara tıklayarak renk rolünüzü seçebilirsiniz:**', components: [row] });
  }

  // ==================== EĞLENCE & KULLANICI ====================

  if (command === 'yazıtura') {
    const sonuc = Math.random() < 0.5 ? 'YAZI 🪙' : 'TURA 🪙';
    return message.reply(`Sonuç: **${sonuc}**`);
  }

  if (command === 'zar') {
    const zar = Math.floor(Math.random() * 6) + 1;
    return message.reply(`🎲 Attığın zar: **${zar}**`);
  }

  if (command === '8ball') {
    const soru = args.join(' ');
    if (!soru) return message.reply('Lütfen bir soru sor!');
    const cevaplar = ['Evet kesinlikle!', 'Şüphesiz evet.', 'Daha sonra tekrar sor.', 'Pek sanmıyorum.', 'Kesinlikle hayır!'];
    return message.reply(`🔮 **Soru:** ${soru}\n**Cevap:** ${cevaplar[Math.floor(Math.random() * cevaplar.length)]}`);
  }

  if (command === 'xp') {
    const xp = userXP.get(userId) || 0;
    return message.reply(`📊 Toplam XP Puanın: **${xp}** (Seviye ${Math.floor(0.1 * Math.sqrt(xp))})`);
  }

  if (command === 'afk') {
    const sebep = args.join(' ') || 'Belirtilmedi';
    afkUsers.set(userId, sebep);
    return message.reply(`💤 **AFK** moduna geçtin. Sebep: *${sebep}*`);
  }

  if (command === 'avatar') {
    const user = message.mentions.users.first() || message.author;
    return message.reply(user.displayAvatarURL({ dynamic: true, size: 1024 }));
  }

  if (command === 'banner') {
    const user = message.mentions.users.first() || message.author;
    const fetchedUser = await client.users.fetch(user.id, { force: true });
    return message.reply(fetchedUser.bannerURL({ dynamic: true, size: 1024 }) || 'Bu kullanıcının afişi (banner) yok.');
  }

  if (command === 'profil') {
    const user = message.mentions.users.first() || message.author;
    const embed = new EmbedBuilder()
      .setTitle(`👤 ${user.username} Profili`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Kullanıcı Tag', value: user.tag },
        { name: 'ID', value: user.id },
        { name: 'XP', value: `${userXP.get(user.id) || 0}` }
      );
    return message.reply({ embeds: [embed] });
  }

  // ==================== BOT & SUNUCU BİLGİ ====================

  if (command === 'istatistik') {
    return message.reply(`🤖 **Bot İstatistikleri:**\n• Sunucu Sayısı: **${client.guilds.cache.size}**\n• Gecikme: **${client.ws.ping}ms**\n• Node.js: **${process.version}**`);
  }

  if (command === 'sunucu-bilgi') {
    return message.reply(`🏰 **${message.guild.name}**\n• Toplam Üye: **${message.guild.memberCount}**\n• Kanal Sayısı: **${message.guild.channels.cache.size}**`);
  }

  if (command === 'harici-bot') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    if (args[0] === 'kapat') { set.hariciBot = true; return message.reply('✅ Harici bot mesajları engellendi.'); }
    if (args[0] === 'aç') { set.hariciBot = false; return message.reply('✅ Harici bot engel kaldırıldı.'); }
  }

  // ==================== MODERASYON ====================

  if (command === 'mute') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;
    const user = message.mentions.members.first();
    const min = parseInt(args[1]) || 10;
    if (!user) return message.reply('Kullanıcı etiketle!');
    await user.timeout(min * 60 * 1000);
    return message.reply(`🔇 **${user.user.tag}** ${min} dakika susturuldu.`);
  }

  if (command === 'unmute') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('Kullanıcı etiketle!');
    await user.timeout(null);
    return message.reply(`🔊 **${user.user.tag}** susturulması kaldırıldı.`);
  }

  if (command === 'ban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return;
    const user = message.mentions.members.first();
    if (user) { await user.ban(); return message.reply(`🔨 **${user.user.tag}** yasaklandı.`); }
  }

  if (command === 'unban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return;
    if (args[0]) { await message.guild.members.unban(args[0]); return message.reply(`✅ Yasağı kaldırıldı.`); }
  }

  if (command === 'kick') {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return;
    const user = message.mentions.members.first();
    if (user) { await user.kick(); return message.reply(`🚪 **${user.user.tag}** atıldı.`); }
  }

  if (command === 'sil') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
    const num = parseInt(args[0]);
    if (num) { await message.channel.bulkDelete(num, true); return message.channel.send(`🧹 ${num} mesaj silindi.`).then(m => setTimeout(() => m.delete(), 2000)); }
  }

  if (command === 'yavaş-mod') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;
    const sec = parseInt(args[0]) || 0;
    await message.channel.setRateLimitPerUser(sec);
    return message.reply(`⏱️ Yavaş mod **${sec}** saniye olarak ayarlandı.`);
  }

  // ==================== SİSTEMLER ====================

  if (command === 'oto-rol') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    if (args[0] === 'sıfırla') { set.otoRol = null; return message.reply('✅ Oto-rol sıfırlandı.'); }
    const role = message.mentions.roles.first();
    if (role) { set.otoRol = role.id; return message.reply(`✅ Oto-rol **${role.name}** olarak ayarlandı.`); }
  }

  if (command === 'hoşgeldin-kanal') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    if (args[0] === 'sıfırla') { set.hosgeldinKanal = null; return message.reply('✅ Hoşgeldin kanalı sıfırlandı.'); }
    const ch = message.mentions.channels.first();
    if (ch) { set.hosgeldinKanal = ch.id; return message.reply(`✅ Hoşgeldin kanalı **${ch.name}** ayarlandı.`); }
  }

  if (command === 'sayaç') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    if (args[0] === 'sıfırla') { set.sayacHedef = null; set.sayacKanal = null; return message.reply('✅ Sayaç sıfırlandı.'); }
    const target = parseInt(args[0]);
    const ch = message.mentions.channels.first();
    if (target && ch) { set.sayacHedef = target; set.sayacKanal = ch.id; return message.reply(`✅ Sayaç hedefi **${target}**, kanalı **${ch.name}** ayarlandı.`); }
  }

  if (command === 'sa-as') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    set.saAs = args[0] === 'aç';
    return message.reply(`✅ SA-AS sistemi **${args[0]}** yapıldı.`);
  }

  if (command === 'küfür-engel') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    set.kufurEngel = args[0] === 'aç';
    return message.reply(`✅ Küfür engel **${args[0]}** yapıldı.`);
  }

  if (command === 'link-engel') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    set.linkEngel = args[0] === 'aç';
    return message.reply(`✅ Link engel **${args[0]}** yapıldı.`);
  }
});

client.login(process.env.TOKEN);
