const WIDTH = 1536;
const HEIGHT = 703;
const canvas = document.getElementById('canvas');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const draw = canvas.getContext('2d');
let map_array = null;

//players is a dictionary
function draw_component(players_and_bullets){
    draw.clearRect(0, 0, WIDTH, HEIGHT);
    let players = players_and_bullets[0];
    let bullets = players_and_bullets[1];
    if (!players) {console.log('players is empty');return};
    if (!map_array) {console.log('map is empty');return};

    //draw map
    map_array.forEach(segment =>{
        draw.fillStyle = 'black';
        draw.fillRect(segment.x, segment.y, segment.width, segment.height);
    });

    //draw bullets
    for (let playerId in bullets){
        let bullet = bullets[playerId];
        draw.beginPath();
        draw.fillStyle = 'black';
        draw.arc(bullet.x + bullet.size/2, bullet.y + bullet.size/2, bullet.size/2, 0, Math.PI * 2);
        draw.fill();
    }

    //draw players
    for (let playerId in players){
        let tank = players[playerId];
        if (tank){            
            draw.fillStyle = tank.color;
            draw.save(); //save state
            //i have to translate the object i want to draw to the origin and then back
            draw.translate(tank.x + tank.width/2, tank.y + tank.height/2);
            draw.rotate(tank.angle); //rotate canvas
    
            //draw tank
            draw.fillRect(-tank.width/2, -tank.height/2, tank.width, tank.height);
            draw.fillRect(-tank.width/2, -tank.height/2 + tank.height * 0.35, tank.width*1.3, tank.height * 0.3);
    
            draw.restore(); //restore to previous        
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
socket.on('new_connection', (players_and_bullets)=>{
    draw_component(players_and_bullets);
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

    socket.emit('movement', direction);
});
window.addEventListener('keyup', (event)=>{
    if (event.key == 'w' || event.key == 'W') direction.forwards = false;    
    if (event.key == 's' || event.key == 'S') direction.backwards = false;
    if (event.key == 'a' || event.key == 'A') direction.left = false;
    if (event.key == 'd' || event.key == 'D') direction.right = false;
    if (event.key == 'q' || event.key == 'f') direction.shoot = false;

    socket.emit('movement', direction);
});

//mobile controls
function bind_mobile_controls(){
    let forwards = document.querySelector('.forwards');
    let backwards = document.querySelector('.backwards');
    let left = document.querySelector('.left');
    let right = document.querySelector('.right');

    //remove context menu pop up when holding a button
    forwards.addEventListener('contextmenu', (event)=>{
        event.preventDefault();
    });
    backwards.addEventListener('contextmenu', (event)=>{
        event.preventDefault();
    });
    left.addEventListener('contextmenu', (event)=>{
        event.preventDefault();
    });
    right.addEventListener('contextmenu', (event)=>{
        event.preventDefault();
    });

    forwards.addEventListener('touchstart', (event)=>{
        direction.forwards = true;
        direction.backwards = false;
        select_element(forwards);
        socket.emit('movement', direction);
    });
    backwards.addEventListener('touchstart', (event)=>{
        direction.forwards = false;
        direction.backwards = true;
        select_element(backwards);
        socket.emit('movement', direction);
    });
    left.addEventListener('touchstart', (event)=>{
        direction.left = true;
        direction.right = false;
        select_element(left);
        socket.emit('movement', direction);
    });
    right.addEventListener('touchstart', (event)=>{
        direction.right = true;
        direction.left = false;
        select_element(right);
        socket.emit('movement', direction);
    });
    //on canvas touch shoot
    canvas.addEventListener('touchstart', (event)=>{
        direction.shoot = true;
        socket.emit('movement', direction);
    });


    forwards.addEventListener("touchend", (event) => {
      direction.forwards = false;
      deselect_element(forwards);
      socket.emit("movement", direction);
    });
    backwards.addEventListener("touchend", (event) => {
      direction.backwards = false;
      deselect_element(backwards);
      socket.emit("movement", direction);
    });
    left.addEventListener("touchend", (event) => {
      direction.left = false;
      deselect_element(left);
      socket.emit("movement", direction);
    });
    right.addEventListener("touchend", (event) => {
      direction.right = false;
      deselect_element(right);
      socket.emit("movement", direction);
    });
    canvas.addEventListener("touchend", (event) => {
      direction.shoot = false;
      socket.emit("movement", direction);
    });

    forwards.addEventListener("touchcancel", (event) => {
      direction.forwards = false;
      socket.emit("movement", direction);
    });
    backwards.addEventListener("touchcancel", (event) => {
      direction.backwards = false;
      socket.emit("movement", direction);
    });
    left.addEventListener("touchcancel", (event) => {
      direction.left = false;
      socket.emit("movement", direction);
    });
    right.addEventListener("touchcancel", (event) => {
      direction.right = false;
      socket.emit("movement", direction);
    });
    canvas.addEventListener("touchcancel", (event) => {
      direction.shoot = false;
      socket.emit("movement", direction);
    });
}
function select_element(element){
    if(element.classList.contains('selected')) return;
    element.classList.add('selected');
}
function deselect_element(element){
    if(element.classList.contains('selected')){
        element.classList.remove('selected');
    };
}

window.onload = ()=>{
    bind_mobile_controls();
}