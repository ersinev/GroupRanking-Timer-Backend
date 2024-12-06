const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(cors());
app.use(express.json());

// Timer verisi
let timer = { minutes: 0, seconds: 0 };
let intervalId = null;
let remainingTime = { minutes: 0, seconds: 0 }; // Kalan zamanı saklamak için değişken

// Timer API'leri
const startTimer = (minutes) => {
  clearInterval(intervalId); // Önce eski timer varsa durdur
  timer = { minutes, seconds: 0 }; // Timer'ı sıfırla
  remainingTime = { minutes, seconds: 0 }; // Kalan zamanı sıfırla

  intervalId = setInterval(() => {
    if (timer.seconds === 0) {
      if (timer.minutes === 0) {
        clearInterval(intervalId); // Timer bittiğinde durdur
        return;
      }
      timer.minutes -= 1;
      timer.seconds = 59;
    } else {
      timer.seconds -= 1;
    }
    io.emit('timerUpdated', timer); // Güncel timer'ı yayınla
  }, 1000); // 1000 ms = 1 saniye
};

const resumeTimer = () => {
  clearInterval(intervalId); // Eğer önceki timer varsa, durdur

  intervalId = setInterval(() => {
    if (remainingTime.seconds === 0) {
      if (remainingTime.minutes === 0) {
        clearInterval(intervalId); // Timer bittiğinde durdur
        return;
      }
      remainingTime.minutes -= 1;
      remainingTime.seconds = 59;
    } else {
      remainingTime.seconds -= 1;
    }

    timer = { minutes: remainingTime.minutes, seconds: remainingTime.seconds };
    io.emit('timerUpdated', timer); // Güncel timer'ı yayınla
  }, 1000);
};

const resetTimer = () => {
  clearInterval(intervalId);
  timer = { minutes: 0, seconds: 0 };
  remainingTime = { minutes: 0, seconds: 0 };
  io.emit('timerUpdated', timer);
};

app.post('/api/timer/start', (req, res) => {
  const { minutes } = req.body;
  startTimer(minutes);
  res.status(200).json({ message: 'Timer started', timer });
});

app.post('/api/timer/resume', (req, res) => {
  resumeTimer();
  res.status(200).json({ message: 'Timer resumed', timer });
});

app.post('/api/timer/reset', (req, res) => {
  resetTimer();
  res.status(200).json({ message: 'Timer reset', timer });
});

app.post('/api/timer/stop', (req, res) => {
  clearInterval(intervalId);
  remainingTime = { minutes: timer.minutes, seconds: timer.seconds }; // Kalan zamanı kaydet
  res.status(200).json({ message: 'Timer stopped', timer });
});

// Öğrenci verisi
let students = [];

app.get('/api/students', (req, res) => {
  res.status(200).json(students);
});

app.post('/api/students', (req, res) => {
  const { name, score } = req.body;
  students.push({ name, score });
  students.sort((a, b) => b.score - a.score);
  io.emit('studentsUpdated', students);
  res.status(201).json({ message: 'Student added', students });
});

app.delete('/api/students/:name', (req, res) => {
  const { name } = req.params;
  students = students.filter((student) => student.name !== name);
  io.emit('studentsUpdated', students);
  res.status(200).json({ message: 'Student deleted', students });
});

app.put('/api/students/:name', (req, res) => {
  const { name } = req.params;
  const { score } = req.body;
  const student = students.find((student) => student.name === name);
  if (student) {
    student.score = score;
    students.sort((a, b) => b.score - a.score);
    io.emit('studentsUpdated', students);
    res.status(200).json({ message: 'Score updated', students });
  } else {
    res.status(404).json({ message: 'Student not found' });
  }
});

io.on('connection', (socket) => {
  console.log('A user connected');
  socket.emit('timerUpdated', timer);
  socket.emit('studentsUpdated', students);

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
