
# Multiplayer Tank Game

Simple version of the classic flash game Tank Trouble, built using websockets and HTML canvas.


## Screenshots

![](https://github.com/everythingisunavailable/Multiplayer-Tank-Game/blob/main/screenshots/tank_one.png)
![](https://github.com/everythingisunavailable/Multiplayer-Tank-Game/blob/main/screenshots/tank_two.png)
![](https://github.com/everythingisunavailable/Multiplayer-Tank-Game/blob/main/screenshots/tank_three.png)

## Lessons Learned

While building this project i learned about the practicallity of using websockets, specifically [socket.io](https://socket.io/), for developing real-time interactive applications, in this case, a multiplayer game.

The hardest part was learning and implementing the Separating Axel Theorem for collision detection between convex polygons.


## Controls
- Keyboard : w, a, s, d to move, q or f to shoot.
- Mobile : onscreen buttons to move, tap on the empty space to shoot.

## Run Locally

Clone the project

```bash
  git clone https://github.com/everythingisunavailable/multiplayerTank
```

Go to the project directory

```bash
  cd Multiplayer-Tank-Game/server
```

Install dependencies

```bash
  npm install
```

Start the server

```bash
  npm run start
```

