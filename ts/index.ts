import bodyParser from "body-parser";
import express, {Request, Response} from "express";

import {Coordinates, Direction, GameRequest, GameState, Move, SnakeInfo} from "./types";

const PORT = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());

app.get("/", handleIndex);
app.post("/start", handleStart);
app.post("/move", handleMove);
app.post("/end", handleEnd);

app.listen(PORT, () => console.log(`TypeScript Battlesnake Server listening at http://127.0.0.1:${PORT}`));

function handleIndex(request: Request, response: Response<SnakeInfo>) {
    const battlesnakeInfo: SnakeInfo = {
        apiversion: "1",
        author: "",
        color: "#BADA55",
        head: "dead",
        tail: "fat-rattle"
    };
    response.status(200).json(battlesnakeInfo);
}

function handleStart(request: GameRequest, response: Response) {
    const gameData = request.body;

    console.log("START");
    response.status(200).send("ok");
}

function remove(directions: Direction[], direction: Direction) {
    let index = directions.indexOf(direction);
    if (index != -1) {
        directions.splice(index, 1);
        console.log("Removed " + direction);
    }
    return directions;
}

function hazardBoard(gameData: GameState) {
    let hazards: boolean[][] = [];
    for (let i = 0; i < gameData.board.height; i++) {
        hazards[i] = [];
        for (let j = 0; j < gameData.board.width; j++) {
            hazards[i][j] = false;
        }
    }
    for (const snake of gameData.board.snakes) {
        // If the snake has full health that means it just ate, so it will be longer next turn, so we have to rule out moving to the tail.
        let len = snake.health == 100 || gameData.turn < 2 ? snake.length : snake.length - 1;
        for (let i = 0; i < len; i++) {
            hazards[snake.body[i].y][snake.body[i].x] = true;
        }
    }
    return hazards;
}

function region(hazards: boolean[][], location: Coordinates) {

    let area: boolean[][] = [];
    for (let i = 0; i < hazards.length; i++) {
        area[i] = [];
        for (let j = 0; j < hazards[0].length; j++) {
            area[i][j] = false;
        }
    }

    function flood(loc: Coordinates) {
        area[loc.y][loc.x] = true;
        const adjs = [{x: loc.x + 1, y: loc.y}, {x: loc.x, y: loc.y + 1}, {x: loc.x - 1, y: loc.y}, {x: loc.x, y: loc.y - 1}];
        for (const adj of adjs) {
            if(adj.x < 0) continue;
            if(adj.y < 0) continue;
            if(adj.x > hazards[0].length - 1) continue;
            if(adj.y > hazards.length - 1) continue;
            if(hazards[adj.y][adj.x]) continue;
            if(area[adj.y][adj.x]) continue;
            flood(adj);
        }
    }
    flood(location);
    let c = 0;
    for (let i = 0; i < area.length; i++) {
        for (let j = 0; j < area[i].length; j++) {
            if(area[i][j]) c++;
        }
    }

    return c;
}

function handleMove(request: GameRequest, response: Response<Move>) {
    const gameData = request.body;

    console.log("Turn: " + gameData.turn);

    const head = gameData.you.head;

    const possibleMoves: Direction[] = ["up", "down", "left", "right"];
    let narrowMoves = possibleMoves;

    const hazards = hazardBoard(gameData);

    // don't go backwards
    // if(head.x > gameData.you.body[1].x) {
    //     narrowMoves = remove(narrowMoves, "left");
    // } else if(head.x < gameData.you.body[1].x) {
    //     narrowMoves = remove(narrowMoves, "right");
    // } else if(head.y > gameData.you.body[1].y) {
    //     narrowMoves = remove(narrowMoves, "down");
    // } else {
    //     narrowMoves = remove(narrowMoves, "up");
    // }
    // Now handled elsewhere

    // don't run into wall
    if(head.x <= 0) {
        narrowMoves = remove(narrowMoves, "left");
    }
    if(head.x >= gameData.board.width - 1) {
        narrowMoves = remove(narrowMoves, "right");
    }
    if(head.y <= 0) {
        narrowMoves = remove(narrowMoves, "down");
    }
    if(head.y >= gameData.board.height - 1) {
        narrowMoves = remove(narrowMoves, "up");
    }

    // don't run into any snakes
    for (const snake of gameData.board.snakes) {
        // If the snake has full health that means it just ate, so it will be longer next turn, so we have to rule out moving to the tail.
        let len = snake.health == 100 || gameData.turn < 2 ? snake.length : snake.length - 1;
        for (let i = 0; i < len; i++) {
            let hazard = snake.body[i];
            if(hazard.x == head.x) {
                if(hazard.y == head.y - 1) {
                    narrowMoves = remove(narrowMoves, "down");
                } else if(hazard.y == head.y + 1) {
                    narrowMoves = remove(narrowMoves, "up");
                }
            } else if(hazard.y == head.y) {
                if(hazard.x == head.x - 1) {
                    narrowMoves = remove(narrowMoves, "left");
                } else if(hazard.x == head.x + 1) {
                    narrowMoves = remove(narrowMoves, "right");
                }
            }
        }
    }

    // Don't do head-to-head collisions
    for (const snake of gameData.board.snakes) {
        let dx = snake.head.x - head.x;
        let dy = snake.head.y - head.y;
        if(Math.abs(dx) + Math.abs(dy) == 2) {
            if(snake.length < gameData.you.length) {
            } else {
                if (dx > 0) {
                    remove(narrowMoves, "right");
                } else if (dx < 0) {
                    remove(narrowMoves, "left");
                }
                if (dy > 0) {
                    remove(narrowMoves, "up");
                } else if (dy < 0) {
                    remove(narrowMoves, "down");
                }
            }
        }
    }

    // Make a better choice than random
    let choices = [];
    for (let i = 0; i < narrowMoves.length; i++) {
        switch (narrowMoves[i]) {
            case "down":
                choices[i] = region(hazards, {x: head.x, y: head.y - 1});
                break
            case "up":
                choices[i] = region(hazards, {x: head.x, y: head.y + 1});
                break
            case "left":
                choices[i] = region(hazards, {x: head.x - 1, y: head.y});
                break
            case "right":
                choices[i] = region(hazards, {x: head.x + 1, y: head.y});
                break
        }
    }
    let largest = 0;
    let largestIndex = -1;
    for (let i = 0; i < choices.length; i++) {
        if(choices[i] > largest) {
            largest = choices[i];
            largestIndex = i;
        }
    }
    console.log(narrowMoves)
    console.log(choices)
    console.log(largest)
    for (let i = 0; i < narrowMoves.length; i++) {
        if(choices[i] < largest) {
            i--;
            choices.splice(i + 1, 1);
            narrowMoves.splice(i + 1, 1);
        }
    }
    console.log(narrowMoves)
    const move = narrowMoves[Math.floor(Math.random() * narrowMoves.length)];

    console.log("MOVE: " + move);
    response.status(200).send({
        move: move
    });
}

function handleEnd(request: GameRequest, response: Response) {
    const gameData = request.body;

    console.log("END");
    response.status(200).send("ok");
}
