const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const correctAnswers = {
    bomb1: "4-9-12",
    bomb2: "5-10-15-20-25",
    bomb3: "1-2-3-4-5-6-7"
};

// ඔයා ලබා දුන් කණ්ඩායම් නාම 10
const teamList = [
    "Kubi.exe",
    "StackOverflow",
    "Everywhere 2.0",
    "BYTE KNIGHTS",
    "Pentabyte",
    "NoZero",
    "The debuggers",
    "CacheMe",
    "Nexus",
    "FrostByte"
];

let teams = {};
let gameState = 'waiting';
let timeLeft = 1200;
let timerInterval = null;

function initTeams() {
    teams = {};
    teamList.forEach(teamName => {
        teams[teamName] = {
            online: false,
            bomb1: { status: 'active', attempts: 0 },
            bomb2: { status: 'active', attempts: 0 },
            bomb3: { status: 'active', attempts: 0 }
        };
    });
}
initTeams();

io.on('connection', (socket) => {
    socket.emit('updateState', teams);
    socket.emit('gameState', { state: gameState, time: timeLeft });

    socket.on('registerTeam', (teamName) => {
        socket.teamName = teamName;
        if(teams[teamName]) {
            teams[teamName].online = true;
            io.emit('updateState', teams);
        }
    });

    socket.on('disconnect', () => {
        if (socket.teamName && teams[socket.teamName]) {
            teams[socket.teamName].online = false;
            io.emit('updateState', teams);
        }
    });

    socket.on('startGame', () => {
        if (gameState === 'waiting') {
            gameState = 'playing';
            timeLeft = 1200;
            io.emit('gameState', { state: gameState, time: timeLeft });
            
            timerInterval = setInterval(() => {
                timeLeft--;
                io.emit('timerUpdate', timeLeft);
                
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    gameState = 'finished';
                    for(let teamName in teams) {
                        ['bomb1', 'bomb2', 'bomb3'].forEach(b => {
                            if(teams[teamName][b].status === 'active') {
                                teams[teamName][b].status = 'exploded';
                            }
                        });
                    }
                    io.emit('gameState', { state: gameState, time: timeLeft });
                    io.emit('updateState', teams);
                }
            }, 1000); 
        }
    });

    socket.on('resetGame', () => {
        clearInterval(timerInterval);
        gameState = 'waiting';
        timeLeft = 1200;
        initTeams();
        io.emit('gameState', { state: gameState, time: timeLeft });
        io.emit('updateState', teams);
    });

    socket.on('submitCode', (data) => {
        if (gameState !== 'playing') return;

        const { team, bomb, code } = data;
        let currentBomb = teams[team]?.[bomb];

        if(!currentBomb || currentBomb.status !== 'active') return;

        if(code === correctAnswers[bomb]) {
            currentBomb.status = 'defused';
        } else {
            currentBomb.attempts += 1;
            if(currentBomb.attempts >= 3) {
                currentBomb.status = 'exploded';
            }
        }
        io.emit('updateState', teams);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));