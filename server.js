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

// Timer Verisi
let timer = { minutes: 0, seconds: 0 };
let intervalId = null;
let remainingTime = { minutes: 0, seconds: 0 };

// Mesaj Verisi
let messages = [];

// Öğrenci Verisi
let students = [];

// Timer İşlemleri
const startTimer = (minutes) => {
  clearInterval(intervalId);
  timer = { minutes, seconds: 0 };
  remainingTime = { minutes, seconds: 0 };

  intervalId = setInterval(() => {
    if (timer.seconds === 0) {
      if (timer.minutes === 0) {
        clearInterval(intervalId); // Timer Bitti
        return;
      }
      timer.minutes -= 1;
      timer.seconds = 59;
    } else {
      timer.seconds -= 1;
    }
    io.emit('timerUpdated', timer);
  }, 1000);
};

const resumeTimer = () => {
  clearInterval(intervalId);

  intervalId = setInterval(() => {
    if (remainingTime.seconds === 0) {
      if (remainingTime.minutes === 0) {
        clearInterval(intervalId);
        return;
      }
      remainingTime.minutes -= 1;
      remainingTime.seconds = 59;
    } else {
      remainingTime.seconds -= 1;
    }
    timer = { minutes: remainingTime.minutes, seconds: remainingTime.seconds };
    io.emit('timerUpdated', timer);
  }, 1000);
};

const resetTimer = () => {
  clearInterval(intervalId);
  timer = { minutes: 0, seconds: 0 };
  remainingTime = { minutes: 0, seconds: 0 };
  io.emit('timerUpdated', timer);
};

// Timer API'leri
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
  remainingTime = { minutes: timer.minutes, seconds: timer.seconds };
  res.status(200).json({ message: 'Timer stopped', timer });
});

// Öğrenci API'leri
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

app.post('/api/messages/deleteAll', (req, res) => {
  messages = [];  // Clear all messages
  io.emit('allMessages', messages); // Emit the updated messages to all connected clients
  res.status(200).json({ message: 'All messages deleted', messages });
});

// Mesajlaşma API'leri
io.on('connection', (socket) => {
  console.log('A user connected');
  
  // İlk verileri gönder
  socket.emit('timerUpdated', timer);
  socket.emit('studentsUpdated', students);
  socket.emit('allMessages', messages);

  // Mesajları Dinle
  socket.on('sendMessage', (messageData) => {
    messages.push(messageData);
    io.emit('receiveMessage', messageData);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Server Başlat
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
