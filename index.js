const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { Player } = require('discord-player');
const express = require('express');

// Web Sunucusu (Render 7/24 Kesintisiz Aktif Tutma)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Mekan Bot 7/24 Kesintisiz Aktif!');
});

app.listen(PORT, () => {
  console.log(`Web sunucusu ${PORT} portunda dinleniyor.`);
});

// Bot İstemcisi
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Discord Player (Müzik Sistemi)
const player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25
  }
});

async function initPlayer() {
  await player.extractors.loadDefault();
}
initPlayer();

// Bellek İçi Veritabanı (XP & Seviye)
const userXP = new Map();

// Bot Hazır
client.once('ready', () => {
  console.log(`Bot aktif! ${client.user.tag} olarak giriş yapıldı.`);
});

// Otomatik Rol Verme (Sunucuya Yeni Katılanlar İçin)
client.on('guildMemberAdd', async (member) => {
  const role = member.guild.roles.cache.find(r => r.name === 'Üye' || r.name === 'Uye');
  if (role) {
    try {
      await member.roles.add(role);
    } catch (e) {
      console.error('Oto-rol verilemedi:', e);
    }
  }
});

// Mesaj & Komut Yakalayıcı
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // XP & Level Sistemi (Mesaj Başına Kazanım)
  const userId = message.author.id;
  const currentXP = userXP.get(userId) || 0;
  const gainedXP = Math.floor(Math.random() * 10) + 5;
  const newXP = currentXP + gainedXP;
  userXP.set(userId, newXP);

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ==================== BİLGİ & YARDIM KOMUTLARI ====================

  if (command === 'yardim' || command === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🛠️ Mekan Bot - Komut Listesi')
      .setDescription('Aşağıda botun tüm kullanılabilir komutları listelenmiştir:')
      .addFields(
        { name: '🎵 Müzik', value: '`!play <şarkı>`, `!stop`, `!skip`, `!queue`, `!pause`, `!resume`, `!ses <1-100>`' },
        { name: '📊 XP & Seviye', value: '`!xp`, `!top` / `!leaderboard`' },
        { name: '🛡️ Moderasyon', value: '`!sil <1-100>`, `!kick @üye`, `!ban @üye`, `!unban <ID>`, `!sa-as <aç/kapat>`' },
        { name: '🎨 Rol & Profil', value: '`!renk <renk>`, `!kullanici-bilgi`, `!sunucu-bilgi`' },
        { name: '⚙️ Genel', value: '`!ping`, `!avatar`' }
      )
      .setFooter({ text: 'Mekan Bot 7/24 Aktif Sistem' });
    return message.reply({ embeds: [embed] });
  }

  if (command === 'ping') {
    return message.reply(`🏓 Pong! Gecikme Sürat: **${client.ws.ping}ms**`);
  }

  if (command === 'avatar') {
    const target = message.mentions.users.first() || message.author;
    return message.reply(target.displayAvatarURL({ dynamic: true, size: 1024 }));
  }

  if (command === 'kullanici-bilgi' || command === 'profile') {
    const member = message.mentions.members.first() || message.member;
    const embed = new EmbedBuilder()
      .setColor('#00FF7F')
      .setTitle(`👤 ${member.user.username} Profil Bilgileri`)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: 'Kullanıcı Adı', value: `${member.user.tag}`, inline: true },
        { name: 'ID', value: `${member.id}`, inline: true },
        { name: 'Katılım Tarihi', value: `${member.joinedAt.toLocaleDateString('tr-TR')}`, inline: true }
      );
    return message.reply({ embeds: [embed] });
  }

  if (command === 'sunucu-bilgi' || command === 'serverinfo') {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`🏰 ${message.guild.name} Sunucu Bilgileri`)
      .setThumbnail(message.guild.iconURL())
      .addFields(
        { name: 'Toplam Üye', value: `${message.guild.memberCount}`, inline: true },
        { name: 'Kanal Sayısı', value: `${message.guild.channels.cache.size}`, inline: true },
        { name: 'Rol Sayısı', value: `${message.guild.roles.cache.size}`, inline: true }
      );
    return message.reply({ embeds: [embed] });
  }

  // ==================== MÜZİK KOMUTLARI ====================

  if (command === 'play' || command === 'p') {
    const channel = message.member.voice.channel;
    if (!channel) return message.reply('Müzik çalmak için bir ses kanalında olmalısın!');

    const query = args.join(' ');
    if (!query) return message.reply('Lütfen bir şarkı adı veya bağlantısı gir!');

    try {
      const { track } = await player.play(channel, query, {
        nodeOptions: { metadata: message }
      });
      return message.reply(`🎵 **${track.title}** sıraya eklendi!`);
    } catch (e) {
      console.error(e);
      return message.reply('Şarkı oynatılırken bir hata oluştu.');
    }
  }

  if (command === 'stop') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply('Şu anda çalan bir müzik yok!');
    queue.delete();
    return message.reply('🛑 Müzik durduruldu ve kanaldan çıkıldı.');
  }

  if (command === 'skip' || command === 's') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply('Şu anda çalan bir müzik yok!');
    queue.node.skip();
    return message.reply('⏭️ Şarkı atlandı!');
  }

  if (command === 'queue' || command === 'q') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply('Şu anda liste boş!');
    const tracks = queue.tracks.toArray().slice(0, 5).map((t, i) => `${i + 1}. **${t.title}**`).join('\n');
    return message.reply(`🎶 **Şu An Çalan:** ${queue.currentTrack.title}\n\n**Sıradakiler:**\n${tracks || 'Sırada başka şarkı yok.'}`);
  }

  if (command === 'pause') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply('Çalan müzik yok!');
    queue.node.pause();
    return message.reply('⏸️ Müzik duraklatıldı.');
  }

  if (command === 'resume') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply('Çalan müzik yok!');
    queue.node.resume();
    return message.reply('▶️ Müzik devam ettiriliyor.');
  }

  if (command === 'ses' || command === 'volume') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply('Çalan müzik yok!');
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 0 || vol > 100) return message.reply('Lütfen 0-100 arasında bir sayı gir.');
    queue.node.setVolume(vol);
    return message.reply(`🔊 Ses seviyesi **%${vol}** olarak ayarlandı.`);
  }

  // ==================== XP & SEVİYE KOMUTLARI ====================

  if (command === 'xp' || command === 'level') {
    const xp = userXP.get(userId) || 0;
    const level = Math.floor(0.1 * Math.sqrt(xp));
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`📊 ${message.author.username} - XP Tablosu`)
      .addFields(
        { name: 'XP Puanı', value: `${xp}`, inline: true },
        { name: 'Seviye', value: `${level}`, inline: true }
      );
    return message.reply({ embeds: [embed] });
  }

  if (command === 'top' || command === 'leaderboard') {
    const sorted = Array.from(userXP.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) return message.reply('Henüz XP kazanan kimse yok!');
    
    let text = sorted.map((entry, index) => {
      const level = Math.floor(0.1 * Math.sqrt(entry[1]));
      return `${index + 1}. <@${entry[0]}> - **${entry[1]} XP** (Seviye ${level})`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#FF1493')
      .setTitle('🏆 En Yüksek XP Sıralaması')
      .setDescription(text);
    return message.reply({ embeds: [embed] });
  }

  // ==================== MODERASYON KOMUTLARI ====================

  if (command === 'sil' || command === 'clear') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply('Bu komut için `Mesajları Yönet` yetkin olmalı!');
    }
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('Lütfen 1-100 arasında bir sayı gir.');
    }
    await message.channel.bulkDelete(amount, true);
    return message.channel.send(`🧹 ${amount} adet mesaj temizlendi.`).then(m => setTimeout(() => m.delete(), 3000));
  }

  if (command === 'kick') {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply('Bu komut için yetkin yetersiz!');
    }
    const user = message.mentions.members.first();
    if (!user) return message.reply('Lütfen atılacak kullanıcıyı etiketle!');
    await user.kick();
    return message.reply(`🚪 **${user.user.tag}** sunucudan atıldı.`);
  }

  if (command === 'ban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('Bu komut için yetkin yetersiz!');
    }
    const user = message.mentions.members.first();
    if (!user) return message.reply('Lütfen yasaklanacak kullanıcıyı etiketle!');
    await user.ban();
    return message.reply(`🔨 **${user.user.tag}** sunucudan yasaklandı.`);
  }

  if (command === 'unban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('Bu komut için yetkin yetersiz!');
    }
    const id = args[0];
    if (!id) return message.reply('Lütfen yasağı kaldırılacak kullanıcının ID numarasını gir.');
    try {
      await message.guild.members.unban(id);
      return message.reply(`✅ **${id}** ID\'li kullanıcının yasağı kaldırıldı.`);
    } catch (e) {
      return message.reply('Kullanıcı bulunamadı veya yasaklı değil.');
    }
  }

  // ==================== ROL KOMUTLARI ====================

  if (command === 'renk') {
    const color = args[0];
    if (!color) return message.reply('Bir renk gir! (Örn: `!renk Kırmızı`, `!renk Mavi`)');
    let role = message.guild.roles.cache.find(r => r.name.toLowerCase() === color.toLowerCase());
    if (!role) return message.reply(`**${color}** adında bir renk rolü bulunamadı.`);
    
    await message.member.roles.add(role);
    return message.reply(`🎨 **${role.name}** rengi hesabına tanımlandı!`);
  }
});

// Botu Başlat
client.login(process.env.TOKEN);
