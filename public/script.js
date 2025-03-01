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
        console.log(player);
        draw.fillRect(Object.values(player)[0].x, Object.values(player)[0].y, Object.values(player)[0].width, Object.values(player)[0].height);
    });
}

const socket = io({
    query: {
        clientId: localStorage.getItem("clientId") || generateClientId()
    }
});

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
})


socket.on("disconnect", () => {
    document.body.innerHTML = "Disconnected.";
});