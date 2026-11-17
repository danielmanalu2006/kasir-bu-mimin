// Pilih alamat IP laptop yang bisa dibuka HP di Wi-Fi yang sama (untuk QR & info terminal).
const os = require('os');

const VIRTUAL = /virtual|vbox|vmware|vethernet|hyper-v|docker|wsl|tailscale|zerotier|hamachi|loopback/i;
const WIFI = /wi-?fi|wlan|wireless|^en0$/i;
const privat = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

/** Semua IPv4 non-internal, diurutkan dari yang paling mungkin bisa dibuka HP. */
function daftarIp() {
  const hasil = [];
  for (const [nama, list] of Object.entries(os.networkInterfaces())) {
    for (const n of list || []) {
      if (n.family !== 'IPv4' || n.internal || n.address.startsWith('169.254.')) continue;
      let skor = 0;
      if (WIFI.test(nama)) skor += 4;
      if (privat(n.address)) skor += 2;
      if (VIRTUAL.test(nama)) skor -= 5;
      if (n.address.startsWith('192.168.56.')) skor -= 3; // host-only VirtualBox
      hasil.push({ nama, alamat: n.address, skor });
    }
  }
  return hasil.sort((a, b) => b.skor - a.skor);
}

/** IP terbaik (atau null). */
const ipLan = () => daftarIp()[0]?.alamat || null;

module.exports = { daftarIp, ipLan };
