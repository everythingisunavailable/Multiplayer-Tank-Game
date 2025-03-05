const WIDTH = 1536;
const HEIGHT = 703;
const canvas = document.getElementById('canvas');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const draw = canvas.getContext('2d');
let map_array = null;

//players is a dictionary
function draw_component(players){
    draw.clearRect(0, 0, WIDTH, HEIGHT);

    if (!players) {console.log('players is empty');return};
    if (!map_array) {console.log('map is empty');return};
    map_array.forEach(segment =>{
        draw.fillRect(segment.x, segment.y, segment.width, segment.height);
    })

    for (let playerId in players){
        let tank = players[playerId];
        if (tank){
            draw.save(); //save state
            //i have to translate the object i want to draw to the origin and then back
            draw.translate(tank.x + tank.width/2, tank.y + tank.height/2);
            draw.rotate(tank.angle); //rotate canvas
    
            //draw tank
            draw.fillRect(-tank.width/2, -tank.height/2, tank.width, tank.height);
            draw.fillRect(-tank.width/2, -tank.height/2 + tank.height * 0.35, tank.width*1.3, tank.height * 0.3);
    
            draw.restore(); //restore to previous
    
            //draw bullet
            draw.fillRect(tank.bullet.x, tank.bullet.y, tank.bullet.size, tank.bullet.size);
        };
    }
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
        clientId: sessionStorage.getItem("clientId") || generateClientId()
    }
});
update();

function generateClientId() {
    const id = Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem("clientId", id);
    return id;
}

socket.on("connect", () => {
    console.log('connected');
});
socket.on('map', (map)=>{
    map_array = map;
})
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

setInterval(update, 1000/70);
function update(){
    socket.emit('movement', direction);
}