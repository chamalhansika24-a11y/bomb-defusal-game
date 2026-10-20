const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // public ෆෝල්ඩරය පෙන්වීමට

// නිවැරදි කේත (Passwords)
const correctAnswers = {
    bomb1: "4-9-12",
    bomb2: "5-10-15-20-25",
    bomb3: "1-2-3-4-5-6-7"
};

let teams = {};
let gameState = 'waiting'; // 'waiting', 'playing', 'finished'
let timeLeft = 1200; // විනාඩි 20 (තත්පර 1200)
let timerInterval = null;

// කණ්ඩායම් 10 මුල් තත්ත්වයට සැකසීම
function initTeams() {
    for(let i=1; i<=10; i++) {
        teams[`Team ${i}`] = {
            bomb1: { status: 'active', attempts: 0 },
            bomb2: { status: 'active', attempts: 0 },
            bomb3: { status: 'active', attempts: 0 }
        };
    }
}
initTeams();

io.on('connection', (socket) => {
    // කවුරුහරි කනෙක්ට් වුණාම දැනට තියෙන තත්ත්වය යවනවා
    socket.emit('updateState', teams);
    socket.emit('gameState', { state: gameState, time: timeLeft });

    // ගේම් එක පටන් ගැනීම
    socket.on('startGame', () => {
        if (gameState === 'waiting') {
            gameState = 'playing';
            timeLeft = 1200;
            io.emit('gameState', { state: gameState, time: timeLeft });
            
            timerInterval = setInterval(() => {
                timeLeft--;
                io.emit('timerUpdate', timeLeft);
                
                // වෙලාව ඉවර වුණාම
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    gameState = 'finished';
                    // ඉතුරු active බෝම්බ ඔටෝ පුපුරවනවා
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

    // ගේම් එක රීසෙට් කිරීම
    socket.on('resetGame', () => {
        clearInterval(timerInterval);
        gameState = 'waiting';
        timeLeft = 1200;
        initTeams();
        io.emit('gameState', { state: gameState, time: timeLeft });
        io.emit('updateState', teams);
    });

    // ළමයෙක් Mobile එකෙන් කේතය Submit කළාම
    socket.on('submitCode', (data) => {
        if (gameState !== 'playing') return; // ගේම් එක යන වෙලාවට විතරයි කේත බාරගන්නේ

        const { team, bomb, code } = data;
        let currentBomb = teams[team][bomb];

        if(currentBomb.status !== 'active') return;

        if(code === correctAnswers[bomb]) {
            currentBomb.status = 'defused'; // කේතය හරි නම්
        } else {
            currentBomb.attempts += 1;
            if(currentBomb.attempts >= 3) {
                currentBomb.status = 'exploded'; // 3 පාරක් වැරදුනොත්
            }
        }
        
        // අලුත් තත්ත්වය තත්පරෙන් Main Dashboard එකට යවනවා!
        io.emit('updateState', teams);
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server is running on http://localhost:3000`));