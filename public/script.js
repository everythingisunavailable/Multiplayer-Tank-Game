const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const canvas = document.getElementById('canvas');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const draw = canvas.getContext('2d');

function draw_component(players){
    draw.clearRect(0, 0, WIDTH, HEIGHT);

    if (!players) {console.log('players is empty');return};

    players.forEach(player => {
        let tank = Object.values(player)[0];
        
        draw.save(); //save state
        //i have to translate the object i want to draw to the origin and then back
        draw.translate(tank.x + tank.height/2, tank.y + tank.width/2);
        draw.rotate(tank.angle); //rotate canvas

        //draw tank
        draw.fillRect(-tank.height/2, -tank.width/2, tank.height, tank.width);
        draw.fillRect(-tank.height/2, -tank.width/2 + tank.width * 0.35, tank.height*1.3, tank.width * 0.3);

        draw.restore(); //restore to previous

        //draw bullet
        draw.fillRect(tank.bullet.x, tank.bullet.y, tank.bullet.size, tank.bullet.size);
    });
}

let direction = {
    left: false,
    right: false,
    forwards: false,
    backwards: false,
    shoot: false
}

const socket = io({
    query: {
        clientId: localStorage.getItem("clientId") || generateClientId()
    }
});
update();

function generateClientId() {
    const id = Math.random().toString(36).substring(2, 9);
    localStorage.setItem("clientId", id);
    return id;
}

socket.on("connect", () => {
    console.log('connected successfully');
});
socket.on('new_connection', (players)=>{
    draw_component(players);
});
socket.on('update', (players)=>{
    draw_component(players);
});
socket.on("disconnect", () => {
    console.log('disconnected');
});

window.addEventListener('keydown', (event)=>{
    if (event.key == 'w' || event.key == 'W') {
        direction.forwards = true;
        direction.backwards = false;
    }
    if (event.key == 's' || event.key == 'S') {
        direction.backwards = true;
        direction.forwards = false;
    }
    if (event.key == 'a' || event.key == 'A') {
        direction.left = true;
        direction.right = false;
    }
    if (event.key == 'd' || event.key == 'D') {
        direction.right = true;
        direction.left = false;
    }
    if (event.key == 'q' || event.key == 'f') {
        direction.shoot = true;
    }

});
window.addEventListener('keyup', (event)=>{
    if (event.key == 'w' || event.key == 'W') direction.forwards = false;    
    if (event.key == 's' || event.key == 'S') direction.backwards = false;
    if (event.key == 'a' || event.key == 'A') direction.left = false;
    if (event.key == 'd' || event.key == 'D') direction.right = false;
    if (event.key == 'q' || event.key == 'f') direction.shoot = false;
});

setInterval(update, 1000/60);
function update(){
    socket.emit('movement', direction);
}