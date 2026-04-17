const RobotLevels = {
    rookie: {
        name: '菜鸟司机',
        reactionTime: 350,
        decisionAccuracy: 0.35,
        pathPlanning: 0.15,
        nearMissChance: 0.02,
        mistakeChance: 0.35,
        maxSpeedMultiplier: 0.55,
        observationRange: 250,
        safeDistance: 150,
        canPlanAhead: false,
        aggressiveDriving: false,
        panicChance: 0.15
    },
    normal: {
        name: '一般司机',
        reactionTime: 180,
        decisionAccuracy: 0.7,
        pathPlanning: 0.55,
        nearMissChance: 0.1,
        mistakeChance: 0.12,
        maxSpeedMultiplier: 0.8,
        observationRange: 400,
        safeDistance: 110,
        canPlanAhead: true,
        aggressiveDriving: false,
        panicChance: 0.05
    },
    veteran: {
        name: '老司机',
        reactionTime: 60,
        decisionAccuracy: 0.92,
        pathPlanning: 0.88,
        nearMissChance: 0.25,
        mistakeChance: 0.015,
        maxSpeedMultiplier: 1.0,
        observationRange: 550,
        safeDistance: 90,
        canPlanAhead: true,
        aggressiveDriving: true,
        panicChance: 0.01
    },
    master: {
        name: '车神',
        reactionTime: 0,
        decisionAccuracy: 1.0,
        pathPlanning: 1.0,
        nearMissChance: 0.5,
        mistakeChance: 0,
        maxSpeedMultiplier: 1.1,
        observationRange: 700,
        safeDistance: 75,
        canPlanAhead: true,
        aggressiveDriving: true,
        panicChance: 0,
        precisionDriving: true
    }
};

class CarGame {
    constructor(options = {}) {
        this.canvasId = options.canvasId || 'gameCanvas';
        this.canvas = document.getElementById(this.canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.isRobot = options.isRobot || false;
        this.robotLevel = options.robotLevel || 'normal';
        this.isCompetitive = options.isCompetitive || false;
        
        this.onGameOver = options.onGameOver || (() => {});
        this.onScoreUpdate = options.onScoreUpdate || (() => {});
        
        this.gameState = 'start';
        this.score = 0;
        this.speed = 0;
        this.maxSpeed = 0;
        this.nearMissCount = 0;
        this.combo = 1;
        
        this.gameSpeed = 1.0;
        this.volume = 70;
        this.particleIntensity = 0.8;
        
        this.trackWidth = 400;
        this.trackOffset = 0;
        this.trackSpeed = 5;
        this.lanes = 3;
        this.laneWidth = this.trackWidth / this.lanes;
        
        this.player = {
            x: 0, targetX: 0, velocityX: 0, y: 0,
            width: 60, height: 100,
            acceleration: 0.8, friction: 0.95,
            maxVelocity: 15, lane: 1
        };
        
        this.keys = { left: false, right: false };
        this.obstacles = [];
        this.obstacleSpawnTimer = 0;
        this.obstacleSpawnInterval = 120;
        
        this.particles = [];
        this.exhaustParticles = [];
        this.shakeOffset = { x: 0, y: 0 };
        this.shakeIntensity = 0;
        this.isGrayscale = false;
        this.grayscaleTimer = 0;
        this.warningIndicators = [];
        this.time = 0;
        this.neonPhase = 0;
        this.nearMissEffect = false;
        this.nearMissTimer = 0;
        this.scorePopups = [];
        
        if (this.isRobot) this.initRobotAI();
        this.init();
    }
    
    initRobotAI() {
        const level = RobotLevels[this.robotLevel];
        this.aiConfig = {
            ...level,
            reactionTimer: 0,
            currentDecision: null,
            decisionTimer: 0,
            targetLane: 1,
            isMistaking: false,
            mistakeTimer: 0,
            isChangingLane: false,
            changeLaneStartLane: -1,
            changeLaneTargetLane: -1,
            lastSituation: null,
            pendingDecision: null,
            decisionStartTime: 0,
            nearMissActive: false,
            nearMissTargetLane: -1,
            nearMissObstacle: null,
            aggressiveDriving: false,
            lastObstacleCount: 0
        };
        this.aiTargetLane = 1;
    }
    
    init() {
        this.resizeCanvas();
        if (!this.isRobot) this.setupEventListeners();
        if (!this.isCompetitive) this.gameLoop();
    }
    
    resizeCanvas() {
        if (this.isCompetitive) {
            this.canvas.width = 800;
            this.canvas.height = 600;
        } else {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
        
        const oldTrackOffset = this.trackOffset;
        this.trackOffset = (this.canvas.width - this.trackWidth) / 2;
        const offsetDelta = this.trackOffset - oldTrackOffset;
        for (const obstacle of this.obstacles) {
            obstacle.x += offsetDelta;
        }
        this.updatePlayerPosition();
        this.player.y = this.canvas.height - 200;
    }
    
    updatePlayerPosition() {
        this.laneWidth = this.trackWidth / this.lanes;
        this.player.targetX = this.trackOffset + this.laneWidth * this.player.lane + this.laneWidth / 2;
    }
    
    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true;
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
        });
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.speed = 80;
        this.maxSpeed = 0;
        this.nearMissCount = 0;
        this.combo = 1;
        this.obstacles = [];
        this.particles = [];
        this.exhaustParticles = [];
        this.warningIndicators = [];
        this.scorePopups = [];
        this.shakeIntensity = 0;
        this.isGrayscale = false;
        this.nearMissEffect = false;
        this.obstacleSpawnTimer = 0;
        if (this.isRobot) this.initRobotAI();
        this.player.lane = 1;
        this.player.velocityX = 0;
        this.updatePlayerPosition();
        this.player.x = this.player.targetX;
    }
    
    gameOver() {
        this.gameState = 'gameover';
        this.isGrayscale = true;
        this.shakeIntensity = 20;
        this.nearMissEffect = false;
        this.nearMissTimer = 0;
        this.scorePopups = [];
        this.onGameOver({
            score: Math.floor(this.score),
            maxSpeed: Math.floor(this.maxSpeed),
            nearMissCount: this.nearMissCount
        });
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        this.time += 0.05 * this.gameSpeed;
        this.neonPhase = Math.sin(this.time * 2);
        
        const maxSpeedLimit = this.isRobot ? 200 * this.aiConfig.maxSpeedMultiplier : 200;
        if (this.speed < maxSpeedLimit) this.speed += 0.02 * this.gameSpeed;
        if (this.speed > this.maxSpeed) this.maxSpeed = this.speed;
        
        this.score += 0.1 * this.combo * this.gameSpeed;
        this.onScoreUpdate(Math.floor(this.score));
        this.updateObstacles();
        this.spawnObstacles();
        this.updateParticles();
        this.spawnExhaust();
        
        if (this.isRobot) this.updateRobotAI();
        this.updatePlayer();
        
        this.checkCollisions();
        this.updateEffects();
        this.updateWarnings();
        this.updateScorePopups();
    }
    
    updateRobotAI() {
        const ai = this.aiConfig;
        
        if (this.aiTargetLane === undefined) {
            this.aiTargetLane = this.player.lane;
        }
        
        if (ai.isChangingLane) {
            this.handleLaneChangeProgress();
            return;
        }
        
        if (ai.nearMissActive) {
            this.handleNearMissProgress();
            return;
        }
        
        if (ai.isMistaking) {
            ai.mistakeTimer--;
            if (ai.mistakeTimer <= 0) {
                ai.isMistaking = false;
            }
            this.executeMistakeBehavior();
            return;
        }
        
        const situation = this.analyzeSituationAdvanced();
        ai.lastSituation = situation;
        
        const shouldTriggerMistake = this.shouldTriggerMistake(situation);
        if (shouldTriggerMistake) {
            this.triggerMistake(situation);
            return;
        }
        
        const decision = this.makeDecision(situation);
        
        if (decision.needsAction) {
            const isEmergency = situation.immediateDanger;
            const reactionFrames = ai.reactionTime / 16.67;
            
            if (ai.reactionTime <= 0 || (isEmergency && ai.reactionTime <= 50)) {
                this.executeDecision(decision, situation);
                ai.reactionTimer = 0;
                ai.pendingDecision = null;
            } else {
                if (ai.reactionTimer === 0) {
                    ai.reactionTimer = 1;
                    ai.decisionStartTime = this.time;
                    ai.pendingDecision = decision;
                } else {
                    ai.reactionTimer++;
                    
                    if (isEmergency) {
                        const emergencyReactionFrames = Math.min(reactionFrames * 0.5, 3);
                        if (ai.reactionTimer >= emergencyReactionFrames) {
                            this.executeDecision(ai.pendingDecision || decision, situation);
                            ai.reactionTimer = 0;
                            ai.pendingDecision = null;
                        }
                    } else {
                        if (ai.reactionTimer >= reactionFrames) {
                            this.executeDecision(ai.pendingDecision || decision, situation);
                            ai.reactionTimer = 0;
                            ai.pendingDecision = null;
                        }
                    }
                }
            }
        } else {
            ai.reactionTimer = 0;
            ai.pendingDecision = null;
            
            if (ai.nearMissChance > 0 && situation.hasNearByObstacles) {
                this.considerNearMiss(situation);
            }
            
            if (this.aiTargetLane !== this.player.lane) {
                this.returnToCenterLane();
            }
        }
    }
    
    handleLaneChangeProgress() {
        const ai = this.aiConfig;
        const targetX = this.trackOffset + this.laneWidth * ai.changeLaneTargetLane + this.laneWidth / 2;
        const distance = Math.abs(this.player.x - targetX);
        
        if (distance < 10) {
            ai.isChangingLane = false;
            ai.changeLaneStartLane = -1;
            ai.changeLaneTargetLane = -1;
            this.player.lane = ai.changeLaneTargetLane;
            this.aiTargetLane = ai.changeLaneTargetLane;
            this.updatePlayerPosition();
        }
    }
    
    handleNearMissProgress() {
        const ai = this.aiConfig;
        
        if (!ai.nearMissObstacle || ai.nearMissObstacle.hasCollided) {
            ai.nearMissActive = false;
            ai.nearMissTargetLane = -1;
            ai.nearMissObstacle = null;
            this.aiTargetLane = this.player.lane;
            return;
        }
        
        const obsY = ai.nearMissObstacle.visualY !== undefined ? ai.nearMissObstacle.visualY : ai.nearMissObstacle.y;
        const playerY = this.player.y;
        
        if (obsY > playerY + 50) {
            ai.nearMissActive = false;
            ai.nearMissTargetLane = -1;
            ai.nearMissObstacle = null;
            this.aiTargetLane = this.player.lane;
            return;
        }
        
        const targetX = this.trackOffset + this.laneWidth * ai.nearMissTargetLane + this.laneWidth / 2;
        const distance = Math.abs(this.player.x - targetX);
        
        if (distance < 10) {
            this.player.lane = ai.nearMissTargetLane;
            this.updatePlayerPosition();
        }
    }
    
    executeMistakeBehavior() {
        const ai = this.aiConfig;
        
        if (ai.mistakeType === 'wrongDirection') {
            const targetX = this.trackOffset + this.laneWidth * this.aiTargetLane + this.laneWidth / 2;
            const distance = Math.abs(this.player.x - targetX);
            if (distance < 10) {
                this.player.lane = this.aiTargetLane;
                this.updatePlayerPosition();
            }
        } else if (ai.mistakeType === 'noAction') {
        } else if (ai.mistakeType === 'overshoot') {
            const targetX = this.trackOffset + this.laneWidth * this.aiTargetLane + this.laneWidth / 2;
            const distance = Math.abs(this.player.x - targetX);
            if (distance < 10) {
                this.player.lane = this.aiTargetLane;
                this.updatePlayerPosition();
            }
        }
    }
    
    shouldTriggerMistake(situation) {
        const ai = this.aiConfig;
        
        if (ai.mistakeChance <= 0) return false;
        
        let baseChance = ai.mistakeChance * 0.02;
        
        if (situation.immediateDanger) {
            baseChance *= 1.5;
        }
        
        if (situation.hasNearByObstacles) {
            baseChance *= 1.2;
        }
        
        if (situation.complexSituation) {
            baseChance *= 2;
        }
        
        return Math.random() < baseChance;
    }
    
    triggerMistake(situation) {
        const ai = this.aiConfig;
        
        const mistakeTypes = ['wrongDirection', 'noAction', 'overshoot', 'slowReaction'];
        const weights = [0.35, 0.25, 0.2, 0.2];
        
        let random = Math.random();
        let selectedType = mistakeTypes[0];
        let cumulative = 0;
        
        for (let i = 0; i < mistakeTypes.length; i++) {
            cumulative += weights[i];
            if (random < cumulative) {
                selectedType = mistakeTypes[i];
                break;
            }
        }
        
        ai.isMistaking = true;
        ai.mistakeType = selectedType;
        ai.mistakeTimer = Math.floor(Math.random() * 30) + 15;
        
        if (selectedType === 'wrongDirection') {
            const wrongDirection = Math.random() > 0.5;
            let targetLane;
            
            if (situation.immediateDanger) {
                const safeLanes = situation.safeLanes.filter(l => l !== this.player.lane);
                if (safeLanes.length > 0) {
                    const bestLane = situation.safeLanes[0];
                    targetLane = wrongDirection ? 
                        (bestLane > this.player.lane ? this.player.lane - 1 : this.player.lane + 1) :
                        bestLane;
                } else {
                    targetLane = wrongDirection ? 
                        Math.max(0, this.player.lane - 1) : 
                        Math.min(this.lanes - 1, this.player.lane + 1);
                }
            } else {
                targetLane = wrongDirection ? 
                    Math.max(0, this.player.lane - 1) : 
                    Math.min(this.lanes - 1, this.player.lane + 1);
            }
            
            targetLane = Math.max(0, Math.min(this.lanes - 1, targetLane));
            this.aiTargetLane = targetLane;
            
        } else if (selectedType === 'overshoot') {
            const direction = Math.random() > 0.5 ? 1 : -1;
            let targetLane = this.player.lane + direction * 2;
            targetLane = Math.max(0, Math.min(this.lanes - 1, targetLane));
            
            if (targetLane !== this.player.lane) {
                this.aiTargetLane = targetLane;
            } else {
                ai.mistakeType = 'noAction';
            }
        }
    }
    
    makeDecision(situation) {
        const ai = this.aiConfig;
        
        let decision = {
            needsAction: false,
            actionType: 'none',
            targetLane: this.player.lane,
            reason: ''
        };
        
        if (situation.immediateDanger) {
            const currentLane = this.player.lane;
            
            if (ai.panicChance && ai.panicChance > 0 && Math.random() < ai.panicChance) {
                decision.needsAction = true;
                decision.actionType = 'panic';
                decision.reason = 'panic';
                
                const randomDirection = Math.random() > 0.5;
                let panicTarget;
                if (randomDirection && currentLane > 0) {
                    panicTarget = currentLane - 1;
                } else if (!randomDirection && currentLane < this.lanes - 1) {
                    panicTarget = currentLane + 1;
                } else {
                    panicTarget = currentLane;
                }
                decision.targetLane = panicTarget;
                return decision;
            }
            
            decision.needsAction = true;
            decision.actionType = 'emergencyAvoid';
            decision.reason = 'immediateDanger';
            decision.isEmergency = true;
            
            const possibleLanes = [];
            
            const isLaneSafeForEmergency = (lane) => {
                const obstacles = situation.laneObstacles[lane];
                const emergencySafeDistance = ai.safeDistance * 0.3;
                
                for (const obsInfo of obstacles) {
                    const dist = obsInfo.distance;
                    if (dist > 0 && dist < emergencySafeDistance) {
                        return false;
                    }
                }
                return true;
            };
            
            const getLaneSafetyScore = (lane) => {
                const obstacles = situation.laneObstacles[lane];
                if (obstacles.length === 0) {
                    return 1000;
                }
                
                let minDist = Infinity;
                for (const obsInfo of obstacles) {
                    const dist = obsInfo.distance;
                    if (dist > 0 && dist < minDist) {
                        minDist = dist;
                    }
                }
                return minDist === Infinity ? 1000 : minDist;
            };
            
            if (currentLane > 0) {
                const leftSafe = isLaneSafeForEmergency(currentLane - 1);
                if (leftSafe) {
                    possibleLanes.push({ 
                        lane: currentLane - 1, 
                        score: getLaneSafetyScore(currentLane - 1) 
                    });
                }
            }
            
            if (currentLane < this.lanes - 1) {
                const rightSafe = isLaneSafeForEmergency(currentLane + 1);
                if (rightSafe) {
                    possibleLanes.push({ 
                        lane: currentLane + 1, 
                        score: getLaneSafetyScore(currentLane + 1) 
                    });
                }
            }
            
            if (possibleLanes.length > 0) {
                possibleLanes.sort((a, b) => b.score - a.score);
                decision.targetLane = possibleLanes[0].lane;
            } else {
                const allAdjacentLanes = [];
                if (currentLane > 0) allAdjacentLanes.push(currentLane - 1);
                if (currentLane < this.lanes - 1) allAdjacentLanes.push(currentLane + 1);
                
                if (allAdjacentLanes.length > 0) {
                    let bestLane = allAdjacentLanes[0];
                    let bestScore = -Infinity;
                    
                    for (const lane of allAdjacentLanes) {
                        const score = getLaneSafetyScore(lane);
                        if (score > bestScore) {
                            bestScore = score;
                            bestLane = lane;
                        }
                    }
                    decision.targetLane = bestLane;
                } else {
                    decision.targetLane = currentLane;
                    decision.actionType = 'none';
                    decision.needsAction = false;
                }
            }
            
            return decision;
        }
        
        if (!ai.canPlanAhead) {
            return decision;
        }
        
        if (situation.nearDanger) {
            const currentScore = situation.laneScores[this.player.lane];
            const scoreThreshold = ai.pathPlanning > 0.7 ? 15 : 25;
            const hasBetterLane = situation.safeLanes.some(lane => {
                return lane !== this.player.lane && situation.laneScores[lane] > currentScore + scoreThreshold;
            });
            
            if (hasBetterLane) {
                decision.needsAction = true;
                decision.actionType = 'avoidance';
                decision.reason = 'nearDanger';
                
                const bestLane = situation.safeLanes.find(lane => {
                    if (lane === this.player.lane) return false;
                    const dist = Math.abs(lane - this.player.lane);
                    return dist <= 1 && this.isLaneSafeForChangeAdvanced(lane, situation, 
                        lane > this.player.lane ? 'right' : 'left');
                });
                
                if (bestLane !== undefined) {
                    decision.targetLane = bestLane;
                } else {
                    decision.needsAction = false;
                    decision.actionType = 'none';
                }
            }
        }
        
        if (ai.pathPlanning > 0.6 && !decision.needsAction) {
            const currentScore = situation.laneScores[this.player.lane];
            const planningThreshold = ai.pathPlanning > 0.85 ? 25 : 35;
            const hasMuchBetterLane = situation.safeLanes.some(lane => {
                return lane !== this.player.lane && situation.laneScores[lane] > currentScore + planningThreshold;
            });
            
            if (hasMuchBetterLane) {
                const bestOption = situation.safeLanes.find(lane => {
                    if (lane === this.player.lane) return false;
                    const dist = Math.abs(lane - this.player.lane);
                    return dist <= 1 && 
                           situation.laneScores[lane] > currentScore + planningThreshold &&
                           this.isLaneSafeForChangeAdvanced(lane, situation,
                               lane > this.player.lane ? 'right' : 'left');
                });
                
                if (bestOption !== undefined) {
                    decision.needsAction = true;
                    decision.actionType = 'proactive';
                    decision.reason = 'pathPlanning';
                    decision.targetLane = bestOption;
                }
            }
        }
        
        if (situation.upcomingBlock && ai.pathPlanning > 0.5) {
            const blockInfo = situation.upcomingBlock;
            const clearLanes = blockInfo.clearLanes;
            
            if (clearLanes.length > 0 && !clearLanes.includes(this.player.lane)) {
                const targetLane = clearLanes.find(lane => {
                    const dist = Math.abs(lane - this.player.lane);
                    return dist <= 1 && this.isLaneSafeForChangeAdvanced(lane, situation,
                        lane > this.player.lane ? 'right' : 'left');
                });
                
                if (targetLane !== undefined) {
                    decision.needsAction = true;
                    decision.actionType = 'proactive';
                    decision.reason = 'upcomingBlock';
                    decision.targetLane = targetLane;
                }
            }
        }
        
        return decision;
    }
    
    executeDecision(decision, situation) {
        if (!decision.needsAction) return;
        if (decision.targetLane === this.player.lane) return;
        
        const ai = this.aiConfig;
        
        if (!decision.isEmergency) {
            const accurateDecision = Math.random() < ai.decisionAccuracy;
            
            if (!accurateDecision) {
                const alternativeLanes = situation.safeLanes.filter(l => 
                    l !== this.player.lane && l !== decision.targetLane
                );
                
                if (alternativeLanes.length > 0) {
                    const randomLane = alternativeLanes[Math.floor(Math.random() * alternativeLanes.length)];
                    if (Math.abs(randomLane - this.player.lane) <= 1) {
                        decision.targetLane = randomLane;
                    }
                }
            }
        }
        
        if (decision.isEmergency) {
            this.startLaneChange(decision.targetLane, true);
        } else {
            const direction = decision.targetLane > this.player.lane ? 'right' : 'left';
            if (this.isLaneSafeForChangeAdvanced(decision.targetLane, situation, direction)) {
                this.startLaneChange(decision.targetLane, false);
            }
        }
    }
    
    startLaneChange(targetLane, isEmergency = false) {
        const ai = this.aiConfig;
        
        ai.isChangingLane = true;
        ai.changeLaneStartLane = this.player.lane;
        ai.changeLaneTargetLane = targetLane;
        this.aiTargetLane = targetLane;
        
        this.player.lane = targetLane;
        this.updatePlayerPosition();
        
        if (isEmergency) {
            this.player.x = this.player.targetX;
            this.player.velocityX = 0;
            ai.isChangingLane = false;
        }
    }
    
    returnToCenterLane() {
        const ai = this.aiConfig;
        
        if (ai.aggressiveDriving) return;
        
        const currentX = this.player.x;
        const currentLaneCenter = this.trackOffset + this.laneWidth * this.player.lane + this.laneWidth / 2;
        const distance = Math.abs(currentX - currentLaneCenter);
        
        if (distance < 5) {
            this.aiTargetLane = this.player.lane;
        }
    }
    
    considerNearMiss(situation) {
        const ai = this.aiConfig;
        
        if (ai.nearMissChance <= 0) return;
        
        if (!ai.aggressiveDriving) return;
        
        if (situation.immediateDanger || situation.nearDanger) return;
        
        const nearMissCandidates = [];
        const safeDist = ai.safeDistance;
        
        const minSafeForNearMiss = ai.precisionDriving ? safeDist * 0.6 : safeDist * 0.9;
        const maxRangeForNearMiss = safeDist * (ai.precisionDriving ? 3.0 : 2.5);
        
        for (let lane = 0; lane < this.lanes; lane++) {
            if (lane === this.player.lane) continue;
            
            const laneChangeSafe = this.isLaneSafeForChangeAdvanced(lane, situation, 
                lane > this.player.lane ? 'right' : 'left');
            
            if (!laneChangeSafe) continue;
            
            const obstacles = situation.laneObstacles[lane];
            for (const obsInfo of obstacles) {
                const dist = obsInfo.distance;
                
                if (dist > minSafeForNearMiss && dist < maxRangeForNearMiss) {
                    nearMissCandidates.push({
                        lane: lane,
                        obstacle: obsInfo.obstacle,
                        distance: dist,
                        direction: lane > this.player.lane ? 'right' : 'left'
                    });
                }
            }
        }
        
        if (nearMissCandidates.length === 0) return;
        
        nearMissCandidates.sort((a, b) => a.distance - b.distance);
        
        let bestCandidate = nearMissCandidates[0];
        
        if (ai.precisionDriving) {
            const idealDistance = safeDist * 1.2;
            nearMissCandidates.sort((a, b) => {
                const distA = Math.abs(a.distance - idealDistance);
                const distB = Math.abs(b.distance - idealDistance);
                return distA - distB;
            });
            bestCandidate = nearMissCandidates[0];
        }
        
        const nearMissChance = ai.precisionDriving ? 
            ai.nearMissChance * 0.015 : 
            ai.nearMissChance * 0.006;
        
        if (Math.random() < nearMissChance) {
            this.startNearMiss(bestCandidate);
        }
    }
    
    startNearMiss(candidate) {
        const ai = this.aiConfig;
        
        ai.nearMissActive = true;
        ai.nearMissTargetLane = candidate.lane;
        ai.nearMissObstacle = candidate.obstacle;
        ai.aggressiveDriving = true;
        this.aiTargetLane = candidate.lane;
        
        this.player.lane = candidate.lane;
        this.updatePlayerPosition();
    }
    
    analyzeSituation() {
        const ai = this.aiConfig;
        const playerY = this.player.y;
        const observationRange = ai.observationRange;
        const safeDistance = ai.safeDistance;
        
        const situation = {
            immediateDanger: false,
            nearDanger: false,
            farObstacles: [],
            laneObstacles: [[], [], []],
            laneScores: [0, 0, 0],
            safeLanes: [],
            hasNearByObstacles: false,
            playerLane: this.player.lane
        };
        
        const immediateZoneStart = playerY - safeDistance - 50;
        const immediateZoneEnd = playerY - 50;
        const nearZoneStart = playerY - observationRange * 0.6;
        const farZoneStart = playerY - observationRange;
        
        for (const obstacle of this.obstacles) {
            const obsY = obstacle.visualY !== undefined ? obstacle.visualY : obstacle.y;
            
            if (obsY > farZoneStart && obsY < immediateZoneEnd) {
                situation.laneObstacles[obstacle.lane].push({
                    obstacle: obstacle,
                    distance: playerY - obsY,
                    y: obsY
                });
                
                if (obsY > nearZoneStart && obsY < immediateZoneEnd) {
                    situation.hasNearByObstacles = true;
                }
                
                if (obsY > immediateZoneStart && obsY < immediateZoneEnd) {
                    if (obstacle.lane === this.player.lane) {
                        situation.immediateDanger = true;
                    }
                }
                
                if (obsY > nearZoneStart && obsY < immediateZoneEnd) {
                    if (obstacle.lane === this.player.lane) {
                        situation.nearDanger = true;
                    }
                }
            }
        }
        
        for (let lane = 0; lane < this.lanes; lane++) {
            situation.laneScores[lane] = this.scoreLane(lane, situation, safeDistance);
        }
        
        const sortedLanes = [0, 1, 2].sort((a, b) => situation.laneScores[b] - situation.laneScores[a]);
        situation.safeLanes = sortedLanes;
        
        return situation;
    }
    
    scoreLane(lane, situation, safeDistance) {
        let score = 100;
        const playerY = this.player.y;
        const obstacles = situation.laneObstacles[lane];
        
        if (obstacles.length === 0) {
            score += 50;
        } else {
            obstacles.sort((a, b) => a.distance - b.distance);
            
            const closestObs = obstacles[0];
            const closestDist = closestObs.distance;
            
            if (closestDist < safeDistance) {
                score -= 100;
            } else if (closestDist < safeDistance * 1.5) {
                score -= 30;
            } else if (closestDist < safeDistance * 2) {
                score -= 10;
            }
            
            score += Math.min(closestDist / 2, 30);
            
            if (obstacles.length >= 2) {
                score -= obstacles.length * 5;
            }
        }
        
        const distanceFromCurrent = Math.abs(lane - this.player.lane);
        score -= distanceFromCurrent * 8;
        
        if (lane === 0 || lane === this.lanes - 1) {
            score -= 5;
        }
        
        return score;
    }
    
    needsLaneChange(situation) {
        const ai = this.aiConfig;
        const currentLaneScore = situation.laneScores[this.player.lane];
        
        if (situation.immediateDanger) {
            return true;
        }
        
        if (situation.nearDanger && ai.canPlanAhead) {
            const hasBetterLane = situation.safeLanes.some(lane => {
                return situation.laneScores[lane] > currentLaneScore + 15;
            });
            return hasBetterLane;
        }
        
        if (ai.pathPlanning > 0.7 && ai.canPlanAhead) {
            const hasBetterLane = situation.safeLanes.some(lane => {
                return situation.laneScores[lane] > currentLaneScore + 25;
            });
            return hasBetterLane;
        }
        
        return false;
    }
    
    chooseBestLaneAdvanced(situation) {
        const ai = this.aiConfig;
        const currentLane = this.player.lane;
        
        if (Math.random() > ai.decisionAccuracy) {
            const availableLanes = situation.safeLanes.filter(l => l !== currentLane);
            if (availableLanes.length > 0) {
                return availableLanes[Math.floor(Math.random() * availableLanes.length)];
            }
            return currentLane;
        }
        
        if (ai.pathPlanning > 0.6) {
            return situation.safeLanes[0];
        } else {
            const availableLanes = situation.safeLanes.filter(l => {
                const dist = Math.abs(l - currentLane);
                return dist <= 1 && situation.laneScores[l] > situation.laneScores[currentLane];
            });
            
            if (availableLanes.length > 0) {
                return availableLanes[0];
            }
            return currentLane;
        }
    }
    
    isLaneSafeForChange(targetLane, situation) {
        const ai = this.aiConfig;
        const safeDistance = ai.safeDistance;
        const playerY = this.player.y;
        
        const obstacles = situation.laneObstacles[targetLane];
        
        for (const obsInfo of obstacles) {
            const dist = obsInfo.distance;
            
            if (dist < safeDistance) {
                return false;
            }
        }
        
        return true;
    }
    
    attemptNearMissAdvanced(situation) {
        const ai = this.aiConfig;
        const currentLane = this.player.lane;
        const safeDistance = ai.safeDistance;
        
        let bestNearMissLane = -1;
        let bestDistance = Infinity;
        
        for (let lane = 0; lane < this.lanes; lane++) {
            if (lane === currentLane) continue;
            
            const obstacles = situation.laneObstacles[lane];
            for (const obsInfo of obstacles) {
                const dist = obsInfo.distance;
                if (dist > safeDistance && dist < safeDistance * 2) {
                    if (dist < bestDistance) {
                        bestDistance = dist;
                        bestNearMissLane = lane;
                    }
                }
            }
        }
        
        if (bestNearMissLane >= 0 && Math.random() < ai.nearMissChance) {
            const direction = bestNearMissLane > currentLane ? 1 : -1;
            const newLane = currentLane + direction;
            
            if (newLane >= 0 && newLane < this.lanes) {
                const tempSituation = {
                    laneObstacles: situation.laneObstacles,
                    safeLanes: situation.safeLanes
                };
                if (this.isLaneSafeForChange(newLane, tempSituation)) {
                    this.aiTargetLane = newLane;
                }
            }
        }
    }
    
    analyzeSituationAdvanced() {
        const ai = this.aiConfig;
        const playerY = this.player.y;
        const observationRange = ai.observationRange;
        const safeDistance = ai.safeDistance;
        
        const situation = {
            immediateDanger: false,
            nearDanger: false,
            farObstacles: [],
            laneObstacles: [[], [], []],
            laneScores: [0, 0, 0],
            safeLanes: [],
            hasNearByObstacles: false,
            playerLane: this.player.lane,
            complexSituation: false,
            upcomingBlock: null,
            allObstacles: []
        };
        
        const criticalZoneStart = playerY - safeDistance * 1.5;
        const criticalZoneEnd = playerY + 50;
        const nearZoneStart = playerY - observationRange * 0.7;
        const nearZoneEnd = playerY + 50;
        const farZoneStart = playerY - observationRange;
        const detectionEnd = playerY + 100;
        
        const criticalZThreshold = 0.15;
        const nearZThreshold = 0.35;
        
        let totalObstaclesInRange = 0;
        let lanesWithObstacles = 0;
        
        for (const obstacle of this.obstacles) {
            const obsY = obstacle.visualY !== undefined ? obstacle.visualY : obstacle.y;
            const obsZ = obstacle.z !== undefined ? obstacle.z : 0;
            
            const isInDetectionRange = (obsY > farZoneStart && obsY < detectionEnd) || (obsZ < 0.6);
            if (!isInDetectionRange) continue;
            
            const visualDistance = playerY - obsY;
            
            let effectiveDistance;
            if (obsZ > 0) {
                effectiveDistance = visualDistance;
            } else {
                effectiveDistance = visualDistance;
            }
            
            const isInCriticalZone = (obsY > criticalZoneStart && obsY < criticalZoneEnd) || (obsZ < criticalZThreshold);
            const isInNearZone = (obsY > nearZoneStart && obsY < nearZoneEnd) || (obsZ < nearZThreshold);
            
            const obsInfo = {
                obstacle: obstacle,
                distance: effectiveDistance,
                visualDistance: visualDistance,
                y: obsY,
                z: obsZ,
                lane: obstacle.lane
            };
            
            situation.allObstacles.push(obsInfo);
            
            if (isInNearZone) {
                situation.laneObstacles[obstacle.lane].push(obsInfo);
                totalObstaclesInRange++;
                situation.hasNearByObstacles = true;
            }
            
            if (isInCriticalZone) {
                if (obstacle.lane === this.player.lane) {
                    situation.immediateDanger = true;
                }
            }
            
            if (isInNearZone && !isInCriticalZone) {
                if (obstacle.lane === this.player.lane) {
                    situation.nearDanger = true;
                }
            }
        }
        
        for (let lane = 0; lane < this.lanes; lane++) {
            if (situation.laneObstacles[lane].length > 0) {
                lanesWithObstacles++;
            }
        }
        
        if (totalObstaclesInRange >= 3 || lanesWithObstacles >= 2) {
            situation.complexSituation = true;
        }
        
        situation.upcomingBlock = this.detectUpcomingBlock(situation);
        
        for (let lane = 0; lane < this.lanes; lane++) {
            situation.laneScores[lane] = this.scoreLaneAdvanced(lane, situation, safeDistance);
        }
        
        const sortedLanes = [0, 1, 2].sort((a, b) => situation.laneScores[b] - situation.laneScores[a]);
        situation.safeLanes = sortedLanes;
        
        return situation;
    }
    
    detectUpcomingBlock(situation) {
        const ai = this.aiConfig;
        const playerY = this.player.y;
        const safeDistance = ai.safeDistance;
        
        const blockZoneStart = playerY - safeDistance * 2;
        const blockZoneEnd = playerY - safeDistance;
        
        const obstaclesInZone = situation.allObstacles.filter(obs => 
            obs.y > blockZoneStart && obs.y < blockZoneEnd
        );
        
        if (obstaclesInZone.length < 2) return null;
        
        const lanesCovered = new Set();
        obstaclesInZone.forEach(obs => lanesCovered.add(obs.lane));
        
        if (lanesCovered.size >= 2) {
            const clearLanes = [];
            for (let lane = 0; lane < this.lanes; lane++) {
                if (!lanesCovered.has(lane)) {
                    clearLanes.push(lane);
                }
            }
            
            if (clearLanes.length > 0) {
                return {
                    isBlocked: true,
                    blockedLanes: Array.from(lanesCovered),
                    clearLanes: clearLanes,
                    distance: playerY - blockZoneEnd
                };
            }
        }
        
        return null;
    }
    
    scoreLaneAdvanced(lane, situation, safeDistance) {
        let score = 100;
        const playerY = this.player.y;
        const obstacles = situation.laneObstacles[lane];
        
        const approachingObstacles = obstacles.filter(obs => obs.distance > 0);
        
        if (approachingObstacles.length === 0) {
            score += 60;
        } else {
            approachingObstacles.sort((a, b) => a.distance - b.distance);
            
            const closestObs = approachingObstacles[0];
            const closestDist = closestObs.distance;
            
            if (closestDist < safeDistance * 0.5) {
                score -= 200;
            } else if (closestDist < safeDistance) {
                score -= 150;
            } else if (closestDist < safeDistance * 1.2) {
                score -= 50;
            } else if (closestDist < safeDistance * 1.5) {
                score -= 20;
            } else if (closestDist < safeDistance * 2) {
                score -= 5;
            }
            
            score += Math.min(closestDist / 1.5, 50);
            
            if (approachingObstacles.length >= 2) {
                const secondObs = approachingObstacles[1];
                if (secondObs.distance < safeDistance * 1.5) {
                    score -= 30;
                }
                score -= approachingObstacles.length * 8;
            }
            
            for (const obs of approachingObstacles) {
                if (obs.distance < safeDistance * 0.3) {
                    score -= 100;
                }
            }
        }
        
        const distanceFromCurrent = Math.abs(lane - this.player.lane);
        score -= distanceFromCurrent * 12;
        
        if (lane === 0 || lane === this.lanes - 1) {
            score -= 8;
        }
        
        if (lane === 1) {
            score += 5;
        }
        
        if (situation.upcomingBlock) {
            if (situation.upcomingBlock.clearLanes.includes(lane)) {
                score += 40;
            } else if (situation.upcomingBlock.blockedLanes.includes(lane)) {
                score -= 30;
            }
        }
        
        return score;
    }
    
    isLaneSafeForChangeAdvanced(targetLane, situation, direction) {
        const ai = this.aiConfig;
        const safeDistance = ai.safeDistance;
        const currentLane = this.player.lane;
        
        if (targetLane < 0 || targetLane >= this.lanes) return false;
        if (Math.abs(targetLane - currentLane) > 1) return false;
        
        const targetObstacles = situation.laneObstacles[targetLane];
        const currentObstacles = situation.laneObstacles[currentLane];
        
        const laneChangeTime = 15;
        const speedFactor = this.speed / 100;
        const effectiveSafeDistance = safeDistance * (1 + speedFactor * 0.5);
        
        for (const obsInfo of targetObstacles) {
            const dist = obsInfo.distance;
            
            if (dist < effectiveSafeDistance * 0.6) {
                return false;
            }
            
            if (dist < effectiveSafeDistance && situation.immediateDanger) {
                return false;
            }
        }
        
        for (const obsInfo of currentObstacles) {
            const dist = obsInfo.distance;
            
            if (dist < safeDistance * 0.4) {
                return false;
            }
            
            if (dist < safeDistance * 0.8 && situation.nearDanger) {
                return false;
            }
        }
        
        const middleLane = Math.min(currentLane, targetLane) + 0.5;
        for (const obsInfo of situation.allObstacles) {
            const obsLane = obsInfo.lane;
            const dist = obsInfo.distance;
            
            if (dist < safeDistance * 0.5) {
                if (obsLane === currentLane || obsLane === targetLane) {
                    return false;
                }
            }
        }
        
        const targetScore = situation.laneScores[targetLane];
        if (targetScore < 50 && !situation.immediateDanger) {
            return false;
        }
        
        return true;
    }
    
    updatePlayer() {
        const playerMinX = this.trackOffset + this.player.width / 2;
        const playerMaxX = this.trackOffset + this.trackWidth - this.player.width / 2;
        const trackLeft = this.trackOffset;
        const trackRight = this.trackOffset + this.trackWidth;
        
        if (this.isRobot) {
            const targetX = this.player.targetX;
            const currentX = this.player.x;
            const distance = targetX - currentX;
            
            if (Math.abs(distance) > 5) {
                if (distance > 0) {
                    this.player.velocityX += this.player.acceleration * this.gameSpeed;
                } else {
                    this.player.velocityX -= this.player.acceleration * this.gameSpeed;
                }
            } else {
                this.player.velocityX *= 0.8;
            }
        } else {
            if (this.keys.left) this.player.velocityX -= this.player.acceleration * this.gameSpeed;
            if (this.keys.right) this.player.velocityX += this.player.acceleration * this.gameSpeed;
        }
        
        this.player.velocityX = Math.max(-this.player.maxVelocity, 
            Math.min(this.player.maxVelocity, this.player.velocityX));
        this.player.velocityX *= this.player.friction;
        
        const newX = this.player.x + this.player.velocityX;
        const playerLeftEdge = newX - this.player.width / 2;
        const playerRightEdge = newX + this.player.width / 2;
        
        const willHitLeftEdge = playerLeftEdge <= trackLeft && this.player.velocityX < 0;
        const willHitRightEdge = playerRightEdge >= trackRight && this.player.velocityX > 0;
        const alreadyAtLeft = this.player.x - this.player.width / 2 <= trackLeft + 1;
        const alreadyAtRight = this.player.x + this.player.width / 2 >= trackRight - 1;
        const stillMovingLeft = this.player.velocityX < -0.1 || this.keys.left;
        const stillMovingRight = this.player.velocityX > 0.1 || this.keys.right;
        
        if ((alreadyAtLeft && stillMovingLeft) || (alreadyAtRight && stillMovingRight) ||
            (willHitLeftEdge && Math.abs(this.player.velocityX) > 0.1) ||
            (willHitRightEdge && Math.abs(this.player.velocityX) > 0.1)) {
            this.createCollisionParticles(this.player.x, this.player.y);
            this.gameOver();
            return;
        }
        
        this.player.x = Math.max(playerMinX, Math.min(playerMaxX, newX));
        const relativeX = this.player.x - this.trackOffset;
        const newLane = Math.floor(relativeX / this.laneWidth);
        
        if (newLane !== this.player.lane && newLane >= 0 && newLane < this.lanes) {
            this.player.lane = newLane;
            this.updatePlayerPosition();
        }
    }
    
    spawnObstacles() {
        this.obstacleSpawnTimer++;
        const adjustedInterval = Math.max(60, this.obstacleSpawnInterval - this.speed * 0.3);
        
        if (this.obstacleSpawnTimer >= adjustedInterval / this.gameSpeed) {
            this.obstacleSpawnTimer = 0;
            const availableLanes = [];
            for (let i = 0; i < this.lanes; i++) {
                const hasObstacleInLane = this.obstacles.some(obs => {
                    const obsY = obs.visualY !== undefined ? obs.visualY : obs.y;
                    return obs.lane === i && (obsY < 200 || obs.z > 0.3);
                });
                const hasWarning = this.warningIndicators.some(w => w.lane === i);
                if (!hasObstacleInLane && !hasWarning) availableLanes.push(i);
            }
            if (availableLanes.length === 0) return;
            
            const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
            const isCar = Math.random() > 0.4;
            
            if (!isCar) {
                this.warningIndicators.push({ lane: lane, timer: 120, alpha: 0 });
            }
            
            setTimeout(() => {
                if (this.gameState === 'playing') {
                    const hasObstacleNow = this.obstacles.some(obs => {
                        const obsY = obs.visualY !== undefined ? obs.visualY : obs.y;
                        return obs.lane === lane && (obsY < 100 || obs.z > 0.5);
                    });
                    if (!hasObstacleNow) {
                        const baseWidth = isCar ? this.player.width * 0.85 : 80;
                        const baseHeight = isCar ? this.player.height * 0.85 : 40;
                        this.obstacles.push({
                            x: this.trackOffset + this.laneWidth * lane + this.laneWidth / 2,
                            y: -150, z: 1.0, lane: lane,
                            type: isCar ? 'car' : 'barrier',
                            width: baseWidth, height: baseHeight,
                            baseWidth: baseWidth, baseHeight: baseHeight,
                            speed: this.speed * 0.8,
                            color: isCar ? this.getRandomCarColor() : null,
                            hasNearMiss: false, hasCollided: false
                        });
                    }
                }
            }, isCar ? 0 : 800);
        }
    }
    
    getRandomCarColor() {
        const colors = [
            { body: '#ff6600', neon: '#ff3300' },
            { body: '#00ff00', neon: '#00cc00' },
            { body: '#ff00ff', neon: '#cc00cc' },
            { body: '#ffff00', neon: '#cccc00' }
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    updateObstacles() {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            obstacle.z -= 0.01 * this.gameSpeed * (this.speed / 100);
            const visualStartY = -400;
            const visualEndY = obstacle.y;
            obstacle.visualY = visualStartY + (visualEndY - visualStartY) * (1 - obstacle.z);
            if (obstacle.z <= 0) {
                obstacle.y += this.trackSpeed * this.gameSpeed * (this.speed / 50);
                obstacle.visualY = obstacle.y;
            }
            if (obstacle.y > this.canvas.height + 100) {
                this.obstacles.splice(i, 1);
            }
        }
    }
    
    calculateObstacleScale(obstacle) {
        const playerY = this.player.y;
        const obsY = obstacle.visualY !== undefined ? obstacle.visualY : obstacle.y;
        const maxDistance = 600;
        const distance = Math.abs(playerY - obsY);
        const normalizedDistance = Math.min(1, distance / maxDistance);
        const minScale = 0.75;
        const maxScale = 0.95;
        const scale = minScale + (maxScale - minScale) * (1 - normalizedDistance);
        return scale;
    }
    
    updateWarnings() {
        for (let i = this.warningIndicators.length - 1; i >= 0; i--) {
            const warning = this.warningIndicators[i];
            warning.timer--;
            warning.alpha = Math.sin(this.time * 10) * 0.5 + 0.5;
            if (warning.timer <= 0) {
                this.warningIndicators.splice(i, 1);
            }
        }
    }
    
    checkCollisions() {
        const playerBounds = {
            left: this.player.x - this.player.width / 2 + 1,
            right: this.player.x + this.player.width / 2 - 1,
            top: this.player.y - this.player.height / 2 + 1,
            bottom: this.player.y + this.player.height / 2 - 1
        };
        
        for (const obstacle of this.obstacles) {
            const useVisualY = obstacle.visualY !== undefined ? obstacle.visualY : obstacle.y;
            if (useVisualY < -200 || useVisualY > this.canvas.height + 100) continue;
            
            const scale = this.calculateObstacleScale(obstacle);
            const obsWidth = obstacle.baseWidth * scale;
            const obsHeight = obstacle.baseHeight * scale;
            const obstacleBounds = {
                left: obstacle.x - obsWidth / 2,
                right: obstacle.x + obsWidth / 2,
                top: useVisualY - obsHeight / 2,
                bottom: useVisualY + obsHeight / 2
            };
            
            const isCollidingNow = this.isColliding(playerBounds, obstacleBounds);
            if (isCollidingNow) {
                obstacle.hasCollided = true;
                if (obstacle.hasNearMiss) {
                    this.nearMissCount = Math.max(0, this.nearMissCount - 1);
                    this.combo = Math.max(1, this.combo - 1);
                    obstacle.hasNearMiss = false;
                }
                this.createCollisionParticles(this.player.x, this.player.y);
                this.gameOver();
                return;
            }
            
            const isCloseEnough = obstacle.z < 0.2 || (useVisualY > this.player.y - 200);
            if (isCloseEnough && !obstacle.hasNearMiss && !obstacle.hasCollided) {
                const visualPlayerBounds = {
                    left: this.player.x - this.player.width / 2,
                    right: this.player.x + this.player.width / 2,
                    top: this.player.y - this.player.height / 2,
                    bottom: this.player.y + this.player.height / 2
                };
                const visualObstacleBounds = {
                    left: obstacle.x - obsWidth / 2,
                    right: obstacle.x + obsWidth / 2,
                    top: useVisualY - obsHeight / 2,
                    bottom: useVisualY + obsHeight / 2
                };
                const nearMissDistance = this.calculateNearMiss(visualPlayerBounds, visualObstacleBounds);
                const inYRange = useVisualY > this.player.y - 150 && useVisualY < this.player.y + 100;
                if (nearMissDistance < 12 && nearMissDistance > 2 && inYRange) {
                    obstacle.hasNearMiss = true;
                    this.triggerNearMiss();
                }
            }
        }
    }
    
    isColliding(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    
    calculateNearMiss(a, b) {
        const dx = Math.max(a.left - b.right, b.left - a.right, 0);
        const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    triggerNearMiss() {
        this.nearMissCount++;
        this.combo = Math.min(5, this.combo + 1);
        const bonusScore = 100 * this.combo;
        this.score += bonusScore;
        this.shakeIntensity = 8;
        this.nearMissEffect = true;
        this.nearMissTimer = 30;
        this.scorePopups.push({
            x: this.player.x, y: this.player.y - 50,
            text: '+' + bonusScore + ' 极限贴近!',
            timer: 60, isDouble: true
        });
    }
    
    updateEffects() {
        if (this.shakeIntensity > 0) {
            this.shakeOffset.x = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeOffset.y = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9;
            if (this.shakeIntensity < 0.1) {
                this.shakeIntensity = 0;
                this.shakeOffset.x = 0;
                this.shakeOffset.y = 0;
            }
        }
        if (this.nearMissTimer > 0) {
            this.nearMissTimer--;
            if (this.nearMissTimer <= 0) this.nearMissEffect = false;
        }
        if (this.isGrayscale && this.gameState === 'gameover') {
            this.grayscaleTimer++;
        }
    }
    
    spawnExhaust() {
        if (this.particleIntensity <= 0) return;
        const exhaustChance = this.particleIntensity * 0.3;
        if (Math.random() < exhaustChance) {
            const offsetX = (Math.random() - 0.5) * 20;
            this.exhaustParticles.push({
                x: this.player.x + offsetX, y: this.player.y + this.player.height / 2,
                vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2 + 1,
                size: Math.random() * 8 + 4, life: 30, maxLife: 30
            });
        }
    }
    
    createCollisionParticles(x, y) {
        if (this.particleIntensity <= 0) return;
        const particleCount = Math.floor(50 * this.particleIntensity);
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 15 + 5;
            this.particles.push({
                x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                size: Math.random() * 6 + 2, life: 60, maxLife: 60,
                color: Math.random() > 0.5 ? '#ff6600' : '#ff0000'
            });
        }
    }
    
    updateParticles() {
        for (let i = this.exhaustParticles.length - 1; i >= 0; i--) {
            const p = this.exhaustParticles[i];
            p.x += p.vx; p.y += p.vy; p.life--;
            if (p.life <= 0) this.exhaustParticles.splice(i, 1);
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.3;
            p.vx *= 0.98; p.vy *= 0.98; p.life--;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }
    
    updateScorePopups() {
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            const popup = this.scorePopups[i];
            popup.y -= 1.5; popup.timer--;
            if (popup.timer <= 0) this.scorePopups.splice(i, 1);
        }
    }
    
    render() {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(-this.shakeOffset.x, -this.shakeOffset.y, this.canvas.width, this.canvas.height);
        this.renderCyberpunkBackground();
        this.renderTrack();
        this.renderWarnings();
        this.renderObstacles();
        this.renderPlayer();
        this.renderParticles();
        this.renderScorePopups();
        ctx.restore();
        
        if (this.isGrayscale) {
            const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
            }
            ctx.putImageData(imageData, 0, 0);
        }
        
        if (this.nearMissEffect) {
            ctx.save();
            ctx.strokeStyle = `rgba(0, 255, 255, ${Math.sin(this.time * 20) * 0.3 + 0.3})`;
            ctx.lineWidth = 8;
            ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.restore();
        }
    }
    
    renderCyberpunkBackground() {
        const ctx = this.ctx;
        const skyGradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        skyGradient.addColorStop(0, '#0a0a1a');
        skyGradient.addColorStop(0.5, '#1a0a2a');
        skyGradient.addColorStop(1, '#0a1a2a');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.strokeStyle = `rgba(0, 255, 255, ${0.1 + this.neonPhase * 0.05})`;
        ctx.lineWidth = 1;
        const gridSpacing = 50;
        const offset = (this.time * 50) % gridSpacing;
        for (let y = 0; y < this.canvas.height; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y + offset);
            ctx.lineTo(this.canvas.width, y + offset);
            ctx.stroke();
        }
        
        for (let i = 0; i < 20; i++) {
            const x = (i * 100 + this.time * 20) % this.canvas.width;
            const y = (Math.sin(i + this.time * 0.5) * 100 + 200);
            const alpha = Math.sin(this.time * 2 + i) * 0.3 + 0.3;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`;
            ctx.fill();
            const glow = ctx.createRadialGradient(x, y, 0, x, y, 15);
            glow.addColorStop(0, `rgba(255, 0, 255, ${alpha * 0.5})`);
            glow.addColorStop(1, 'rgba(255, 0, 255, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    renderTrack() {
        const ctx = this.ctx;
        const trackLeft = this.trackOffset;
        const trackRight = trackLeft + this.trackWidth;
        
        const trackGradient = ctx.createLinearGradient(trackLeft, 0, trackRight, 0);
        trackGradient.addColorStop(0, '#0a0a15');
        trackGradient.addColorStop(0.5, '#1a1a2a');
        trackGradient.addColorStop(1, '#0a0a15');
        ctx.fillStyle = trackGradient;
        ctx.fillRect(trackLeft, 0, this.trackWidth, this.canvas.height);
        
        const neonIntensity = 0.5 + this.neonPhase * 0.3;
        this.renderNeonEdge(trackLeft, true, neonIntensity);
        this.renderNeonEdge(trackRight, false, neonIntensity);
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + this.neonPhase * 0.1})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([30, 20]);
        const lineOffset = (this.time * 200 * this.gameSpeed * (this.speed / 100)) % 50;
        for (let i = 1; i < this.lanes; i++) {
            const x = trackLeft + this.laneWidth * i;
            ctx.beginPath();
            ctx.moveTo(x, -lineOffset);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        
        const dotOffset = (this.time * 300 * this.gameSpeed * (this.speed / 100)) % 40;
        for (let lane = 0; lane < this.lanes; lane++) {
            const centerX = trackLeft + this.laneWidth * lane + this.laneWidth / 2;
            for (let y = -dotOffset; y < this.canvas.height; y += 40) {
                ctx.beginPath();
                ctx.arc(centerX, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 255, 255, ${0.2 + this.neonPhase * 0.1})`;
                ctx.fill();
            }
        }
    }
    
    renderNeonEdge(x, isLeft, intensity) {
        const ctx = this.ctx;
        ctx.strokeStyle = isLeft ? 
            `rgba(0, 255, 255, ${intensity})` : 
            `rgba(255, 0, 255, ${intensity})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
        ctx.stroke();
        
        const outerGlow = ctx.createRadialGradient(x, this.canvas.height / 2, 0, x, this.canvas.height / 2, 30);
        outerGlow.addColorStop(0, isLeft ? 
            `rgba(0, 255, 255, ${intensity * 0.3})` : 
            `rgba(255, 0, 255, ${intensity * 0.3})`);
        outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = outerGlow;
        ctx.fillRect(x - 30, 0, 60, this.canvas.height);
        
        const innerGlow = ctx.createRadialGradient(x, this.canvas.height / 2, 0, x, this.canvas.height / 2, 10);
        innerGlow.addColorStop(0, isLeft ? 
            `rgba(255, 255, 255, ${intensity * 0.5})` : 
            `rgba(255, 255, 255, ${intensity * 0.5})`);
        innerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = innerGlow;
        ctx.fillRect(x - 10, 0, 20, this.canvas.height);
    }
    
    renderWarnings() {
        const ctx = this.ctx;
        for (const warning of this.warningIndicators) {
            const x = this.trackOffset + this.laneWidth * warning.lane + this.laneWidth / 2;
            const y = 30;
            ctx.save();
            ctx.translate(x, y);
            const alpha = warning.alpha;
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(-18, 15);
            ctx.lineTo(18, 15);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', 0, 2);
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
            glow.addColorStop(0, `rgba(255, 0, 0, ${alpha * 0.5})`);
            glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    
    renderObstacles() {
        const ctx = this.ctx;
        for (const obstacle of this.obstacles) {
            const scale = this.calculateObstacleScale(obstacle);
            const alpha = Math.max(0.5, 1 - obstacle.z * 0.3);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(obstacle.x, obstacle.visualY !== undefined ? obstacle.visualY : obstacle.y);
            ctx.scale(scale, scale);
            if (obstacle.type === 'car') {
                this.renderEnemyCar(ctx, obstacle);
            } else {
                this.renderBarrier(ctx, obstacle);
            }
            ctx.restore();
        }
    }
    
    renderEnemyCar(ctx, obstacle) {
        const color = obstacle.color || { body: '#ff6600', neon: '#ff3300' };
        const w = obstacle.baseWidth;
        const h = obstacle.baseHeight;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-w/2 + 3, -h/2 + 3, w, h);
        
        const bodyGradient = ctx.createLinearGradient(-w/2, 0, w/2, 0);
        bodyGradient.addColorStop(0, color.body);
        bodyGradient.addColorStop(0.5, this.lightenColor(color.body, 30));
        bodyGradient.addColorStop(1, color.body);
        ctx.fillStyle = bodyGradient;
        
        ctx.beginPath();
        ctx.moveTo(-w/3, h/2);
        ctx.lineTo(-w/2, h/3);
        ctx.lineTo(-w/2, -h/4);
        ctx.lineTo(-w/3, -h/2);
        ctx.lineTo(w/3, -h/2);
        ctx.lineTo(w/2, -h/4);
        ctx.lineTo(w/2, h/3);
        ctx.lineTo(w/3, h/2);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = this.darkenColor(color.body, 20);
        ctx.beginPath();
        ctx.moveTo(-w/4, h/6);
        ctx.lineTo(-w/4, -h/4);
        ctx.lineTo(w/4, -h/4);
        ctx.lineTo(w/4, h/6);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-w/5, h/8);
        ctx.lineTo(-w/5, -h/6);
        ctx.lineTo(w/5, -h/6);
        ctx.lineTo(w/5, h/8);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.fillRect(-w/2 + 5, h/2 - 8, 12, 6);
        ctx.fillRect(w/2 - 17, h/2 - 8, 12, 6);
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = color.neon;
        ctx.lineWidth = 2;
        ctx.shadowColor = color.neon;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(-w/2 + 2, -h/2 + 5);
        ctx.lineTo(w/2 - 2, -h/2 + 5);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    renderBarrier(ctx, obstacle) {
        const w = obstacle.baseWidth;
        const h = obstacle.baseHeight;
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.fillStyle = '#ffff00';
        const stripeWidth = 15;
        const stripeCount = Math.floor(w / stripeWidth);
        for (let i = 0; i < stripeCount; i++) {
            if (i % 2 === 0) {
                ctx.fillRect(-w/2 + i * stripeWidth, -h/2, stripeWidth, h);
            }
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-w/2, -h/2, w, h);
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 4;
        ctx.strokeRect(-w/2 - 2, -h/2 - 2, w + 4, h + 4);
        ctx.shadowBlur = 0;
    }
    
    renderPlayer() {
        const ctx = this.ctx;
        const p = this.player;
        ctx.save();
        ctx.translate(p.x, p.y);
        const tilt = p.velocityX * 0.5;
        ctx.rotate(tilt * Math.PI / 180);
        this.renderPlayerCar(ctx);
        ctx.restore();
    }
    
    renderPlayerCar(ctx) {
        const w = this.player.width;
        const h = this.player.height;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-w/2 + 5, -h/2 + 5, w, h);
        
        const bodyGradient = ctx.createLinearGradient(-w/2, 0, w/2, 0);
        bodyGradient.addColorStop(0, '#006666');
        bodyGradient.addColorStop(0.3, '#00cccc');
        bodyGradient.addColorStop(0.5, '#00ffff');
        bodyGradient.addColorStop(0.7, '#00cccc');
        bodyGradient.addColorStop(1, '#006666');
        ctx.fillStyle = bodyGradient;
        
        ctx.beginPath();
        ctx.moveTo(-w/3, h/2);
        ctx.lineTo(-w/2, h/3);
        ctx.lineTo(-w/2, -h/5);
        ctx.lineTo(-w/3, -h/2);
        ctx.lineTo(w/3, -h/2);
        ctx.lineTo(w/2, -h/5);
        ctx.lineTo(w/2, h/3);
        ctx.lineTo(w/3, h/2);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#004444';
        ctx.beginPath();
        ctx.moveTo(-w/4, h/6);
        ctx.lineTo(-w/5, -h/3);
        ctx.lineTo(w/5, -h/3);
        ctx.lineTo(w/4, h/6);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
        ctx.beginPath();
        ctx.moveTo(-w/5, h/8);
        ctx.lineTo(-w/6, -h/4);
        ctx.lineTo(w/6, -h/4);
        ctx.lineTo(w/5, h/8);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(-w/3, -h/2 + 5, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(w/3, -h/2 + 5, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        const headlightGradient = ctx.createRadialGradient(0, -h/2, 0, 0, -h/2 - 80, 80);
        headlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        headlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = headlightGradient;
        ctx.beginPath();
        ctx.moveTo(-w/2, -h/2);
        ctx.lineTo(-w/2 - 30, -h/2 - 100);
        ctx.lineTo(w/2 + 30, -h/2 - 100);
        ctx.lineTo(w/2, -h/2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = '#008888';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.fillRect(-w/2 - 10, h/2 - 5, w + 20, 8);
        ctx.fillRect(-w/3, h/2 - 15, 5, 15);
        ctx.fillRect(w/3 - 5, h/2 - 15, 5, 15);
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.fillRect(-w/2 + 5, h/2 - 10, 12, 6);
        ctx.fillRect(w/2 - 17, h/2 - 10, 12, 6);
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(-w/2 + 5, h/2);
        ctx.lineTo(w/2 - 5, h/2);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-w/2 + 3, -h/4);
        ctx.lineTo(-w/2 + 3, h/4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w/2 - 3, -h/4);
        ctx.lineTo(w/2 - 3, h/4);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = '#ff00ff';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-w/5, -h/3);
        ctx.lineTo(w/5, -h/3);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    renderParticles() {
        const ctx = this.ctx;
        for (const p of this.exhaustParticles) {
            const alpha = p.life / p.maxLife;
            const size = p.size * (1 + (1 - alpha) * 0.5);
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
            gradient.addColorStop(0, `rgba(200, 200, 200, ${alpha * 0.5})`);
            gradient.addColorStop(1, `rgba(100, 100, 100, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.fillStyle = p.color || `rgba(255, 100, 0, ${alpha})`;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    
    renderScorePopups() {
        const ctx = this.ctx;
        for (const popup of this.scorePopups) {
            const alpha = popup.timer / 60;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = popup.isDouble ? 'bold 28px Arial' : 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (popup.isDouble) {
                ctx.fillStyle = '#ffff00';
                ctx.shadowColor = '#ff00ff';
                ctx.shadowBlur = 15;
            } else {
                ctx.fillStyle = '#00ff00';
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 10;
            }
            ctx.fillText(popup.text, popup.x, popup.y);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }
    
    lightenColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    darkenColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class GameManager {
    constructor() {
        this.mode = 'menu';
        this.singleGame = null;
        this.playerGame = null;
        this.robotGame = null;
        this.robotLevel = 'normal';
        this.isRunning = false;
        this.playerStats = null;
        this.robotStats = null;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.getElementById('single-mode-btn').addEventListener('click', () => this.startSingleMode());
        document.getElementById('competitive-mode-btn').addEventListener('click', () => this.showRobotSelection());
        document.getElementById('back-to-menu-btn').addEventListener('click', () => this.showMainMenu());
        
        document.querySelectorAll('.robot-level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.robotLevel = btn.dataset.level;
                this.startCompetitiveMode();
            });
        });
        
        document.getElementById('start-button').addEventListener('click', () => {
            if (this.singleGame) {
                this.singleGame.startGame();
                document.getElementById('start-screen').classList.add('hidden');
            }
        });
        
        document.getElementById('restart-button').addEventListener('click', () => this.restartSingleGame());
        document.getElementById('single-menu-btn').addEventListener('click', () => this.showMainMenu());
        document.getElementById('gameover-menu-btn').addEventListener('click', () => this.showMainMenu());
        document.getElementById('competitive-restart-btn').addEventListener('click', () => this.restartCompetitiveGame());
        document.getElementById('competitive-menu-btn').addEventListener('click', () => this.showMainMenu());
        document.getElementById('competitive-back-btn').addEventListener('click', () => this.showMainMenu());
        
        const gameSpeedSlider = document.getElementById('game-speed');
        const volumeSlider = document.getElementById('volume');
        const particlesSlider = document.getElementById('particles');
        
        if (gameSpeedSlider) {
            gameSpeedSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (this.singleGame) this.singleGame.gameSpeed = value;
                if (this.playerGame) this.playerGame.gameSpeed = value;
                if (this.robotGame) this.robotGame.gameSpeed = value;
                document.getElementById('speed-value').textContent = value.toFixed(1) + 'x';
            });
        }
        
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (this.singleGame) this.singleGame.volume = value;
                if (this.playerGame) this.playerGame.volume = value;
                if (this.robotGame) this.robotGame.volume = value;
                document.getElementById('volume-value').textContent = value + '%';
            });
        }
        
        if (particlesSlider) {
            particlesSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                const intensity = value / 100;
                if (this.singleGame) this.singleGame.particleIntensity = intensity;
                if (this.playerGame) this.playerGame.particleIntensity = intensity;
                if (this.robotGame) this.robotGame.particleIntensity = intensity;
                document.getElementById('particles-value').textContent = value + '%';
            });
        }
        
        window.addEventListener('keydown', (e) => {
            if (this.playerGame && this.playerGame.gameState === 'playing') {
                if (e.key === 'ArrowLeft' || e.key === 'a') this.playerGame.keys.left = true;
                if (e.key === 'ArrowRight' || e.key === 'd') this.playerGame.keys.right = true;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (this.playerGame) {
                if (e.key === 'ArrowLeft' || e.key === 'a') this.playerGame.keys.left = false;
                if (e.key === 'ArrowRight' || e.key === 'd') this.playerGame.keys.right = false;
            }
        });
        
        window.addEventListener('resize', () => {
            if (this.singleGame) this.singleGame.resizeCanvas();
            if (this.playerGame) this.playerGame.resizeCanvas();
            if (this.robotGame) this.robotGame.resizeCanvas();
        });
    }
    
    showMainMenu() {
        this.mode = 'menu';
        this.isRunning = false;
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('robot-selection').classList.add('hidden');
        document.getElementById('single-game-container').classList.add('hidden');
        document.getElementById('competitive-game-container').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('competitive-gameover').classList.add('hidden');
        this.singleGame = null;
        this.playerGame = null;
        this.robotGame = null;
    }
    
    showRobotSelection() {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('robot-selection').classList.remove('hidden');
    }
    
    startSingleMode() {
        this.mode = 'single';
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('single-game-container').classList.remove('hidden');
        this.singleGame = new CarGame({
            canvasId: 'gameCanvas',
            onGameOver: (stats) => this.handleSingleGameOver(stats),
            onScoreUpdate: (score) => {
                document.getElementById('score').textContent = score;
                document.getElementById('speed').textContent = Math.floor(this.singleGame.speed);
                if (this.singleGame.combo > 1) {
                    document.getElementById('combo-display').classList.remove('hidden');
                    document.getElementById('combo').textContent = 'x' + this.singleGame.combo;
                }
            }
        });
        document.getElementById('start-screen').classList.remove('hidden');
    }
    
    handleSingleGameOver(stats) {
        setTimeout(() => {
            document.getElementById('gameover-screen').classList.remove('hidden');
            document.getElementById('final-score').textContent = stats.score;
            document.getElementById('max-speed').textContent = stats.maxSpeed + ' KM/H';
            document.getElementById('near-miss-count').textContent = stats.nearMissCount;
        }, 1000);
    }
    
    restartSingleGame() {
        document.getElementById('gameover-screen').classList.add('hidden');
        if (this.singleGame) this.singleGame.startGame();
    }
    
    startCompetitiveMode() {
        this.mode = 'competitive';
        this.isRunning = true;
        this.playerStats = null;
        this.robotStats = null;
        document.getElementById('robot-selection').classList.add('hidden');
        document.getElementById('competitive-game-container').classList.remove('hidden');
        const levelInfo = RobotLevels[this.robotLevel];
        document.getElementById('robot-label').textContent = levelInfo.name;
        document.getElementById('robot-final-label').textContent = levelInfo.name;
        document.getElementById('player-status').classList.remove('crashed');
        document.getElementById('robot-status').classList.remove('crashed');
        document.getElementById('player-status').querySelector('.status-text').textContent = '比赛中';
        document.getElementById('robot-status').querySelector('.status-text').textContent = '比赛中';
        document.getElementById('player-score').textContent = '0';
        document.getElementById('robot-score').textContent = '0';
        
        this.playerGame = new CarGame({
            canvasId: 'playerCanvas',
            isCompetitive: true,
            onGameOver: (stats) => this.handlePlayerGameOver(stats),
            onScoreUpdate: (score) => {
                document.getElementById('player-score').textContent = score;
            }
        });
        this.robotGame = new CarGame({
            canvasId: 'robotCanvas',
            isRobot: true,
            robotLevel: this.robotLevel,
            isCompetitive: true,
            onGameOver: (stats) => this.handleRobotGameOver(stats),
            onScoreUpdate: (score) => {
                document.getElementById('robot-score').textContent = score;
            }
        });
        
        this.playerGame.startGame();
        this.robotGame.startGame();
        this.competitiveGameLoop();
    }
    
    handlePlayerGameOver(stats) {
        this.playerStats = stats;
        document.getElementById('player-status').classList.add('crashed');
        document.getElementById('player-status').querySelector('.status-text').textContent = '已撞车';
        this.checkCompetitiveEnd();
    }
    
    handleRobotGameOver(stats) {
        this.robotStats = stats;
        document.getElementById('robot-status').classList.add('crashed');
        document.getElementById('robot-status').querySelector('.status-text').textContent = '已撞车';
        this.checkCompetitiveEnd();
    }
    
    checkCompetitiveEnd() {
        if (this.playerStats && this.robotStats) {
            this.isRunning = false;
            setTimeout(() => this.showCompetitiveResult(), 1000);
        }
    }
    
    showCompetitiveResult() {
        document.getElementById('competitive-gameover').classList.remove('hidden');
        const playerScore = this.playerStats.score;
        const robotScore = this.robotStats.score;
        document.getElementById('player-final-score').textContent = playerScore;
        document.getElementById('robot-final-score').textContent = robotScore;
        
        const winnerAnnouncement = document.getElementById('winner-announcement');
        const winnerTitle = document.getElementById('winner-title');
        const winnerSubtitle = document.getElementById('winner-subtitle');
        
        if (playerScore > robotScore) {
            winnerAnnouncement.textContent = '玩家获胜！';
            winnerAnnouncement.classList.remove('draw');
            winnerTitle.textContent = '胜利';
            winnerTitle.className = 'game-title winner';
            winnerSubtitle.textContent = 'YOU WIN';
        } else if (robotScore > playerScore) {
            winnerAnnouncement.textContent = RobotLevels[this.robotLevel].name + '获胜！';
            winnerAnnouncement.classList.remove('draw');
            winnerTitle.textContent = '游戏结束';
            winnerTitle.className = 'game-title gameover';
            winnerSubtitle.textContent = 'GAME OVER';
        } else {
            winnerAnnouncement.textContent = '平局！';
            winnerAnnouncement.classList.add('draw');
            winnerTitle.textContent = '平局';
            winnerTitle.className = 'game-title';
            winnerSubtitle.textContent = 'DRAW';
        }
    }
    
    restartCompetitiveGame() {
        this.playerStats = null;
        this.robotStats = null;
        this.isRunning = true;
        document.getElementById('competitive-gameover').classList.add('hidden');
        document.getElementById('player-status').classList.remove('crashed');
        document.getElementById('robot-status').classList.remove('crashed');
        document.getElementById('player-status').querySelector('.status-text').textContent = '比赛中';
        document.getElementById('robot-status').querySelector('.status-text').textContent = '比赛中';
        document.getElementById('player-score').textContent = '0';
        document.getElementById('robot-score').textContent = '0';
        if (this.playerGame) this.playerGame.startGame();
        if (this.robotGame) this.robotGame.startGame();
    }
    
    competitiveGameLoop() {
        if (!this.isRunning || this.mode !== 'competitive') return;
        if (this.playerGame && this.playerGame.gameState !== 'gameover') {
            this.playerGame.update();
            this.playerGame.render();
        }
        if (this.robotGame && this.robotGame.gameState !== 'gameover') {
            this.robotGame.update();
            this.robotGame.render();
        }
        requestAnimationFrame(() => this.competitiveGameLoop());
    }
}

window.addEventListener('load', () => {
    new GameManager();
});
