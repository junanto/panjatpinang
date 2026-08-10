const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Serve file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Bank Soal Kuis
const quizData = [
  { question: "Berapakah hasil dari 15 + 28?", options: ["41", "43", "45", "42"], answer: 1 },
  { question: "Ibu kota negara Indonesia yang baru bernama...", options: ["IKN Nusantara", "Jakarta", "Surabaya", "Bandung"], answer: 0 },
  { question: "Proses pembuatan makanan pada tumbuhan hijau dinamakan...", options: ["Respirasi", "Fotosintesis", "Transpirasi", "Oksidasi"], answer: 1 },
  { question: "Pancasila ke-3 berbunyi...", options: ["Ketuhanan Yang Maha Esa", "Keadilan Sosial", "Persatuan Indonesia", "Kemanusiaan yang Adil"], answer: 2 },
  { question: "Planet terbesar dalam tata surya kita adalah...", options: ["Bumi", "Saturnus", "Jupiter", "Mars"], answer: 2 },
  { question: "Lagu 'Indonesia Raya' diciptakan oleh...", options: ["W.R. Soepratman", "Ibu Soed", "C. Simanjuntak", "Kusbini"], answer: 0 },
  { question: "Simbol unsur kimia untuk Air adalah...", options: ["CO2", "H2O", "O2", "NaCl"], answer: 1 },
  { question: "Jumlah provinsi di Indonesia saat ini adalah...", options: ["34", "38", "37", "35"], answer: 1 }
];

let rooms = {};

io.on('connection', (socket) => {
  console.log('User terhubung:', socket.id);

  // Event ketika pemain bergabung ke dalam Room
  socket.on('joinRoom', ({ roomId, playerName }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: {},
        playerCount: 0,
        gameStarted: false
      };
    }

    const room = rooms[roomId];

    if (room.playerCount < 2 && !room.players[socket.id]) {
      room.playerCount++;
      const playerSlot = room.playerCount === 1 ? 1 : 2;

      room.players[socket.id] = {
        id: socket.id,
        name: playerName || `Pemain ${playerSlot}`,
        slot: playerSlot,
        step: 0
      };

      // Beritahu pemain posisi/slot mereka
      socket.emit('playerAssigned', {
        slot: playerSlot,
        name: room.players[socket.id].name,
        quizData: quizData
      });

      // Update daftar pemain di room
      io.to(roomId).emit('roomState', {
        players: Object.values(room.players),
        playerCount: room.playerCount
      });

      // Mulai game jika sudah ada 2 pemain
      if (room.playerCount === 2) {
        room.gameStarted = true;
        io.to(roomId).emit('startGame', {
          message: 'Kedua pemain sudah bergabung! Permainan dimulai!'
        });
      }
    } else if (room.playerCount >= 2) {
      socket.emit('roomFull', 'Kamar ini sudah penuh (Maksimal 2 pemain).');
    }
  });

  // Event ketika pemain menjawab BENAR
  socket.on('correctAnswer', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id] || !room.gameStarted) return;

    const player = room.players[socket.id];
    if (player.step < 5) {
      player.step += 1;
    }

    // Broadcast posisi terbaru ke SEMUA pemain di room
    io.to(roomId).emit('updatePosition', {
      players: Object.values(room.players)
    });

    // Cek kondisi menang
    if (player.step >= 5) {
      room.gameStarted = false;
      io.to(roomId).emit('gameOver', {
        winnerSlot: player.slot,
        winnerName: player.name
      });
    }
  });

  // Event ketika pemain menjawab SALAH (Merosot 1 step)
  socket.on('wrongAnswer', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id] || !room.gameStarted) return;

    const player = room.players[socket.id];
    if (player.step > 0) {
      player.step -= 1;
    }

    io.to(roomId).emit('updatePosition', {
      players: Object.values(room.players)
    });
  });

  // Penanganan ketika pemain keluar / disconnect
  socket.on('disconnect', () => {
    console.log('User terputus:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        room.playerCount--;
        room.gameStarted = false;

        io.to(roomId).emit('playerLeft', {
          message: 'Salah satu pemain terputus dari permainan.'
        });

        if (room.playerCount === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server Panjat Pinang berjalan di http://localhost:${PORT}`);
});
