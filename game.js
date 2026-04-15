class CarGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 游戏状态
        this.gameState = 'start'; // start, playing, gameover
        this.score = 0;
        this.speed = 0;
        this.maxSpeed = 0;
        this.nearMissCount = 0;
        this.combo = 1;
        
        // 游戏设置
        this.gameSpeed = 1.0;
        this.volume = 70;
        this.particleIntensity = 0.8;
        
        // 赛道参数
        this.trackWidth = 400;
        this.trackOffset = 0;
        this.trackSpeed = 5;
        this.lanes = 3;
        this.laneWidth = this.trackWidth / this.lanes;
        
        // 玩家车辆
        this.player = {
            x: 0,
            targetX: 0,
            velocityX: 0,
            y: 0,
            width: 60,
            height: 100,
            acceleration: 0.8,
            friction: 0.95,
            maxVelocity: 15,
            lane: 1 // 0, 1, 2
        };
        
        // 输入状态
        this.keys = {
            left: false,
            right: false
        };
        
        // 障碍物
        this.obstacles = [];
        this.obstacleSpawnTimer = 0;
        this.obstacleSpawnInterval = 120;
        
        // 粒子系统
        this.particles = [];
        this.exhaustParticles = [];
        
        // 视觉效果
        this.shakeOffset = { x: 0, y: 0 };
        this.shakeIntensity = 0;
        this.isGrayscale = false;
        this.grayscaleTimer = 0;
        
        // 警告指示器
        this.warningIndicators = [];
        
        // 动画时间
        this.time = 0;
        this.neonPhase = 0;
        
        // 擦边球效果
        this.nearMissEffect = false;
        this.nearMissTimer = 0;
        
        // 分数弹出
        this.scorePopups = [];
        
        this.init();
    }
    
    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.gameLoop();
    }
    
    resizeCanvas() {
        const oldTrackOffset = this.trackOffset;
        
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // 更新赛道和玩家位置
        this.trackOffset = (this.canvas.width - this.trackWidth) / 2;
        
        // 计算偏移量变化
        const offsetDelta = this.trackOffset - oldTrackOffset;
        
        // 更新所有已存在障碍物的位置
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
        // 键盘事件
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') {
                this.keys.left = true;
            }
            if (e.key === 'ArrowRight' || e.key === 'd') {
                this.keys.right = true;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') {
                this.keys.left = false;
            }
            if (e.key === 'ArrowRight' || e.key === 'd') {
                this.keys.right = false;
            }
        });
        
        // 窗口大小改变
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // UI 按钮
        document.getElementById('start-button').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('restart-button').addEventListener('click', () => {
            this.startGame();
        });
        
        // 滑块控制
        document.getElementById('game-speed').addEventListener('input', (e) => {
            this.gameSpeed = parseFloat(e.target.value);
            document.getElementById('speed-value').textContent = this.gameSpeed.toFixed(1) + 'x';
        });
        
        document.getElementById('volume').addEventListener('input', (e) => {
            this.volume = parseInt(e.target.value);
            document.getElementById('volume-value').textContent = this.volume + '%';
        });
        
        document.getElementById('particles').addEventListener('input', (e) => {
            this.particleIntensity = parseInt(e.target.value) / 100;
            document.getElementById('particles-value').textContent = e.target.value + '%';
        });
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
        
        // 重置玩家位置
        this.player.lane = 1;
        this.player.velocityX = 0;
        this.updatePlayerPosition();
        this.player.x = this.player.targetX;
        
        // 隐藏覆盖层
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('combo-display').classList.add('hidden');
    }
    
    gameOver() {
        this.gameState = 'gameover';
        this.isGrayscale = true;
        this.shakeIntensity = 20;
        
        // 清除所有擦边效果
        this.nearMissEffect = false;
        this.nearMissTimer = 0;
        
        // 清除分数弹出
        this.scorePopups = [];
        
        // 显示游戏结束界面
        setTimeout(() => {
            document.getElementById('gameover-screen').classList.remove('hidden');
            document.getElementById('final-score').textContent = Math.floor(this.score);
            document.getElementById('max-speed').textContent = Math.floor(this.maxSpeed) + ' KM/H';
            document.getElementById('near-miss-count').textContent = this.nearMissCount;
        }, 1000);
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        this.time += 0.05 * this.gameSpeed;
        this.neonPhase = Math.sin(this.time * 2);
        
        // 更新玩家控制
        this.updatePlayer();
        
        // 更新速度（随时间增加）
        if (this.speed < 200) {
            this.speed += 0.02 * this.gameSpeed;
        }
        if (this.speed > this.maxSpeed) {
            this.maxSpeed = this.speed;
        }
        
        // 基础分数
        this.score += 0.1 * this.combo * this.gameSpeed;
        
        // 更新障碍物
        this.updateObstacles();
        
        // 生成障碍物
        this.spawnObstacles();
        
        // 更新粒子
        this.updateParticles();
        
        // 生成尾气粒子
        this.spawnExhaust();
        
        // 碰撞检测
        this.checkCollisions();
        
        // 更新视觉效果
        this.updateEffects();
        
        // 更新警告指示器
        this.updateWarnings();
        
        // 更新分数弹出
        this.updateScorePopups();
        
        // 更新 HUD
        document.getElementById('score').textContent = Math.floor(this.score);
        document.getElementById('speed').textContent = Math.floor(this.speed);
        
        if (this.combo > 1) {
            document.getElementById('combo-display').classList.remove('hidden');
            document.getElementById('combo').textContent = 'x' + this.combo;
        }
    }
    
    updatePlayer() {
        // 计算边界 - 玩家中心的边界
        const playerMinX = this.trackOffset + this.player.width / 2;
        const playerMaxX = this.trackOffset + this.trackWidth - this.player.width / 2;
        
        // 赛道实际边缘
        const trackLeft = this.trackOffset;
        const trackRight = this.trackOffset + this.trackWidth;
        
        // 输入处理
        if (this.keys.left) {
            this.player.velocityX -= this.player.acceleration * this.gameSpeed;
        }
        if (this.keys.right) {
            this.player.velocityX += this.player.acceleration * this.gameSpeed;
        }
        
        // 限制最大速度
        this.player.velocityX = Math.max(-this.player.maxVelocity, 
            Math.min(this.player.maxVelocity, this.player.velocityX));
        
        // 应用摩擦力
        this.player.velocityX *= this.player.friction;
        
        // 预测新位置
        const newX = this.player.x + this.player.velocityX;
        
        // 计算玩家边缘位置
        const playerLeftEdge = newX - this.player.width / 2;
        const playerRightEdge = newX + this.player.width / 2;
        
        // 边缘碰撞检测 - 检查玩家是否会越界
        // 如果玩家持续向边缘移动并且已经在边缘，游戏结束
        const willHitLeftEdge = playerLeftEdge <= trackLeft && this.player.velocityX < 0;
        const willHitRightEdge = playerRightEdge >= trackRight && this.player.velocityX > 0;
        
        // 更严格的检测：如果玩家已经在边缘并且还在向边缘移动
        const alreadyAtLeft = this.player.x - this.player.width / 2 <= trackLeft + 1;
        const alreadyAtRight = this.player.x + this.player.width / 2 >= trackRight - 1;
        const stillMovingLeft = this.player.velocityX < -0.1 || this.keys.left;
        const stillMovingRight = this.player.velocityX > 0.1 || this.keys.right;
        
        if ((alreadyAtLeft && stillMovingLeft) || (alreadyAtRight && stillMovingRight) ||
            (willHitLeftEdge && Math.abs(this.player.velocityX) > 0.1) ||
            (willHitRightEdge && Math.abs(this.player.velocityX) > 0.1)) {
            // 撞到边缘 - 游戏结束
            this.createCollisionParticles(this.player.x, this.player.y);
            this.gameOver();
            return;
        }
        
        // 更新位置（限制在边界内）
        this.player.x = Math.max(playerMinX, Math.min(playerMaxX, newX));
        
        // 确定当前车道
        const relativeX = this.player.x - this.trackOffset;
        const newLane = Math.floor(relativeX / this.laneWidth);
        
        if (newLane !== this.player.lane && newLane >= 0 && newLane < this.lanes) {
            this.player.lane = newLane;
            this.updatePlayerPosition();
        }
    }
    
    spawnObstacles() {
        this.obstacleSpawnTimer++;
        
        // 根据速度调整生成间隔
        const adjustedInterval = Math.max(60, this.obstacleSpawnInterval - this.speed * 0.3);
        
        if (this.obstacleSpawnTimer >= adjustedInterval / this.gameSpeed) {
            this.obstacleSpawnTimer = 0;
            
            // 找出可用的车道（没有障碍物在生成区域的车道）
            const availableLanes = [];
            for (let i = 0; i < this.lanes; i++) {
                // 检查该车道是否已有障碍物在生成区域（y < 200 或 z > 0.3）
                const hasObstacleInLane = this.obstacles.some(obs => {
                    const obsY = obs.visualY !== undefined ? obs.visualY : obs.y;
                    return obs.lane === i && (obsY < 200 || obs.z > 0.3);
                });
                
                // 检查该车道是否已有警告
                const hasWarning = this.warningIndicators.some(w => w.lane === i);
                
                if (!hasObstacleInLane && !hasWarning) {
                    availableLanes.push(i);
                }
            }
            
            // 如果没有可用车道，跳过这次生成
            if (availableLanes.length === 0) {
                return;
            }
            
            // 从可用车道中随机选择
            const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
            
            // 随机选择障碍物类型
            const isCar = Math.random() > 0.4;
            
            // 添加警告指示器（非车辆障碍物）
            if (!isCar) {
                this.warningIndicators.push({
                    lane: lane,
                    timer: 120, // 2秒警告
                    alpha: 0
                });
            }
            
            // 创建障碍物（延迟生成，让警告显示一段时间）
            setTimeout(() => {
                if (this.gameState === 'playing') {
                    // 再次检查该车道是否仍然可用（防止延迟期间有其他障碍物生成）
                    const hasObstacleNow = this.obstacles.some(obs => {
                        const obsY = obs.visualY !== undefined ? obs.visualY : obs.y;
                        return obs.lane === lane && (obsY < 100 || obs.z > 0.5);
                    });
                    
                    if (!hasObstacleNow) {
                        this.obstacles.push({
                            x: this.trackOffset + this.laneWidth * lane + this.laneWidth / 2,
                            y: -150,
                            z: 1.0, // 伪3D深度（远景=1.0，近景=0）
                            lane: lane,
                            type: isCar ? 'car' : 'barrier',
                            width: isCar ? 50 : 80,
                            height: isCar ? 80 : 40,
                            speed: this.speed * 0.8,
                            color: isCar ? this.getRandomCarColor() : null,
                            hasNearMiss: false,
                            hasCollided: false
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
            
            // 伪3D效果：z值减小表示靠近
            obstacle.z -= 0.01 * this.gameSpeed * (this.speed / 100);
            
            // 重要：根据z值计算视觉y位置
            // 当z=1.0时，障碍物在屏幕上方远处；当z=0时，到达实际y位置
            const visualStartY = -400; // 远景起始位置
            const visualEndY = obstacle.y; // 近景目标位置
            obstacle.visualY = visualStartY + (visualEndY - visualStartY) * (1 - obstacle.z);
            
            // 当z接近0时，障碍物开始在近景移动
            if (obstacle.z <= 0) {
                obstacle.y += this.trackSpeed * this.gameSpeed * (this.speed / 50);
                obstacle.visualY = obstacle.y;
            }
            
            // 移除超出屏幕的障碍物
            if (obstacle.y > this.canvas.height + 100) {
                this.obstacles.splice(i, 1);
            }
        }
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
        // 玩家碰撞盒 - 几乎不内缩，确保视觉碰撞=检测碰撞
        const playerBounds = {
            left: this.player.x - this.player.width / 2 + 1,
            right: this.player.x + this.player.width / 2 - 1,
            top: this.player.y - this.player.height / 2 + 1,
            bottom: this.player.y + this.player.height / 2 - 1
        };
        
        for (const obstacle of this.obstacles) {
            // 使用visualY进行检测，扩大检测范围
            const useVisualY = obstacle.visualY !== undefined ? obstacle.visualY : obstacle.y;
            
            // 只检测在合理范围内的障碍物
            if (useVisualY < -200 || useVisualY > this.canvas.height + 100) continue;
            
            // 计算伪3D缩放 - 根据z值或visualY位置
            let scale;
            if (obstacle.z > 0) {
                scale = Math.max(0.4, 1 - obstacle.z * 0.6);
            } else {
                // 当z<=0时，根据距离玩家的距离微调缩放
                const distanceToPlayer = this.player.y - useVisualY;
                scale = Math.max(0.8, Math.min(1.2, 1 + (distanceToPlayer / 1000)));
            }
            
            const obsWidth = obstacle.width * scale;
            const obsHeight = obstacle.height * scale;
            
            // 障碍物碰撞盒 - 几乎不内缩，使用visualY
            const obstacleBounds = {
                left: obstacle.x - obsWidth / 2,
                right: obstacle.x + obsWidth / 2,
                top: useVisualY - obsHeight / 2,
                bottom: useVisualY + obsHeight / 2
            };
            
            // 首先检测碰撞 - 使用实际碰撞盒
            const isCollidingNow = this.isColliding(playerBounds, obstacleBounds);
            
            // 碰撞检测
            if (isCollidingNow) {
                // 标记障碍物已碰撞
                obstacle.hasCollided = true;
                
                // 如果这个障碍物之前被错误标记为擦边球，撤销它
                if (obstacle.hasNearMiss) {
                    this.nearMissCount = Math.max(0, this.nearMissCount - 1);
                    this.combo = Math.max(1, this.combo - 1);
                    obstacle.hasNearMiss = false;
                }
                
                // 创建碰撞粒子
                this.createCollisionParticles(this.player.x, this.player.y);
                this.gameOver();
                return;
            }
            
            // 只有在确定没有碰撞时，才检测擦边球
            // 只有当障碍物足够近时才检测（z较小或visualY接近玩家）
            const isCloseEnough = obstacle.z < 0.2 || (useVisualY > this.player.y - 200);
            
            if (isCloseEnough && !obstacle.hasNearMiss && !obstacle.hasCollided) {
                // 使用视觉边界计算擦边球距离
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
                
                // 严格的擦边球检测：距离必须在2-12像素之间
                // 且障碍物必须在玩家附近（Y轴范围内）
                const inYRange = useVisualY > this.player.y - 150 && useVisualY < this.player.y + 100;
                
                if (nearMissDistance < 12 && nearMissDistance > 2 && inYRange) {
                    obstacle.hasNearMiss = true;
                    this.triggerNearMiss();
                }
            }
        }
    }
    
    isColliding(a, b) {
        return a.left < b.right &&
               a.right > b.left &&
               a.top < b.bottom &&
               a.bottom > b.top;
    }
    
    calculateNearMiss(a, b) {
        // 计算两个矩形边缘的最小距离
        const dx = Math.max(a.left - b.right, b.left - a.right, 0);
        const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    triggerNearMiss() {
        this.nearMissCount++;
        this.combo = Math.min(5, this.combo + 1);
        
        // 双倍积分奖励
        const bonusScore = 100 * this.combo;
        this.score += bonusScore;
        
        // 屏幕抖动效果
        this.shakeIntensity = 8;
        this.nearMissEffect = true;
        this.nearMissTimer = 30;
        
        // 显示分数弹出
        this.scorePopups.push({
            x: this.player.x,
            y: this.player.y - 50,
            text: '+' + bonusScore + ' 极限贴近!',
            timer: 60,
            isDouble: true
        });
    }
    
    updateEffects() {
        // 震动效果衰减
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
        
        // 擦边球效果
        if (this.nearMissTimer > 0) {
            this.nearMissTimer--;
            if (this.nearMissTimer <= 0) {
                this.nearMissEffect = false;
            }
        }
        
        // 黑白效果定时器
        if (this.isGrayscale && this.gameState === 'gameover') {
            this.grayscaleTimer++;
        }
    }
    
    spawnExhaust() {
        if (this.particleIntensity <= 0) return;
        
        // 基于速度生成尾气
        const exhaustChance = this.particleIntensity * 0.3;
        
        if (Math.random() < exhaustChance) {
            const offsetX = (Math.random() - 0.5) * 20;
            this.exhaustParticles.push({
                x: this.player.x + offsetX,
                y: this.player.y + this.player.height / 2,
                vx: (Math.random() - 0.5) * 2,
                vy: Math.random() * 2 + 1,
                size: Math.random() * 8 + 4,
                life: 30,
                maxLife: 30
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
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 6 + 2,
                life: 60,
                maxLife: 60,
                color: Math.random() > 0.5 ? '#ff6600' : '#ff0000'
            });
        }
    }
    
    updateParticles() {
        // 更新尾气粒子
        for (let i = this.exhaustParticles.length - 1; i >= 0; i--) {
            const p = this.exhaustParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            
            if (p.life <= 0) {
                this.exhaustParticles.splice(i, 1);
            }
        }
        
        // 更新碰撞粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3; // 重力
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.life--;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    updateScorePopups() {
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            const popup = this.scorePopups[i];
            popup.y -= 1.5;
            popup.timer--;
            
            if (popup.timer <= 0) {
                this.scorePopups.splice(i, 1);
            }
        }
    }
    
    render() {
        const ctx = this.ctx;
        
        // 应用震动偏移
        ctx.save();
        ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
        
        // 清空画布
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(-this.shakeOffset.x, -this.shakeOffset.y, this.canvas.width, this.canvas.height);
        
        // 绘制赛博朋克背景
        this.renderCyberpunkBackground();
        
        // 绘制赛道
        this.renderTrack();
        
        // 绘制警告指示器
        this.renderWarnings();
        
        // 绘制障碍物
        this.renderObstacles();
        
        // 绘制玩家
        this.renderPlayer();
        
        // 绘制粒子
        this.renderParticles();
        
        // 绘制分数弹出
        this.renderScorePopups();
        
        ctx.restore();
        
        // 应用黑白滤镜效果
        if (this.isGrayscale) {
            const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
            }
            
            ctx.putImageData(imageData, 0, 0);
        }
        
        // 擦边球效果边框
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
        
        // 渐变天空
        const skyGradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        skyGradient.addColorStop(0, '#0a0a1a');
        skyGradient.addColorStop(0.5, '#1a0a2a');
        skyGradient.addColorStop(1, '#0a1a2a');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 网格线效果（远景）
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
        
        // 霓虹光点
        for (let i = 0; i < 20; i++) {
            const x = (i * 100 + this.time * 20) % this.canvas.width;
            const y = (Math.sin(i + this.time * 0.5) * 100 + 200);
            const alpha = Math.sin(this.time * 2 + i) * 0.3 + 0.3;
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`;
            ctx.fill();
            
            // 光晕
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
        
        // 赛道主体
        const trackGradient = ctx.createLinearGradient(trackLeft, 0, trackRight, 0);
        trackGradient.addColorStop(0, '#0a0a15');
        trackGradient.addColorStop(0.5, '#1a1a2a');
        trackGradient.addColorStop(1, '#0a0a15');
        
        ctx.fillStyle = trackGradient;
        ctx.fillRect(trackLeft, 0, this.trackWidth, this.canvas.height);
        
        // 赛道边缘霓虹呼吸灯
        const neonIntensity = 0.5 + this.neonPhase * 0.3;
        
        // 左边缘
        this.renderNeonEdge(trackLeft, true, neonIntensity);
        
        // 右边缘
        this.renderNeonEdge(trackRight, false, neonIntensity);
        
        // 车道分隔线
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
        
        // 赛道表面纹理（移动的点）
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
        
        // 主霓虹线
        ctx.strokeStyle = isLeft ? 
            `rgba(0, 255, 255, ${intensity})` : 
            `rgba(255, 0, 255, ${intensity})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
        ctx.stroke();
        
        // 外层光晕
        const outerGlow = ctx.createRadialGradient(x, this.canvas.height / 2, 0, x, this.canvas.height / 2, 30);
        outerGlow.addColorStop(0, isLeft ? 
            `rgba(0, 255, 255, ${intensity * 0.3})` : 
            `rgba(255, 0, 255, ${intensity * 0.3})`);
        outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = outerGlow;
        ctx.fillRect(x - 30, 0, 60, this.canvas.height);
        
        // 内层强光晕
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
            
            // 三角形警告符号
            ctx.save();
            ctx.translate(x, y);
            
            const alpha = warning.alpha;
            
            // 三角形背景
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(-18, 15);
            ctx.lineTo(18, 15);
            ctx.closePath();
            ctx.fill();
            
            // 三角形边框
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 感叹号
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', 0, 2);
            
            // 光晕效果
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
            // 伪3D缩放计算
            const scale = Math.max(0.3, 1 - obstacle.z * 0.7);
            const alpha = Math.max(0.3, 1 - obstacle.z * 0.5);
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(obstacle.x, obstacle.y);
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
        const w = obstacle.width;
        const h = obstacle.height;
        
        // 车身阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-w/2 + 3, -h/2 + 3, w, h);
        
        // 车身主体
        const bodyGradient = ctx.createLinearGradient(-w/2, 0, w/2, 0);
        bodyGradient.addColorStop(0, color.body);
        bodyGradient.addColorStop(0.5, this.lightenColor(color.body, 30));
        bodyGradient.addColorStop(1, color.body);
        
        ctx.fillStyle = bodyGradient;
        
        // 流线型车身
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
        
        // 车顶
        ctx.fillStyle = this.darkenColor(color.body, 20);
        ctx.beginPath();
        ctx.moveTo(-w/4, h/6);
        ctx.lineTo(-w/4, -h/4);
        ctx.lineTo(w/4, -h/4);
        ctx.lineTo(w/4, h/6);
        ctx.closePath();
        ctx.fill();
        
        // 车窗
        ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-w/5, h/8);
        ctx.lineTo(-w/5, -h/6);
        ctx.lineTo(w/5, -h/6);
        ctx.lineTo(w/5, h/8);
        ctx.closePath();
        ctx.fill();
        
        // 尾灯（红色）
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.fillRect(-w/2 + 5, h/2 - 8, 12, 6);
        ctx.fillRect(w/2 - 17, h/2 - 8, 12, 6);
        ctx.shadowBlur = 0;
        
        // 霓虹装饰线
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
        const w = obstacle.width;
        const h = obstacle.height;
        
        // 路障主体
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-w/2, -h/2, w, h);
        
        // 黄色警示条纹
        ctx.fillStyle = '#ffff00';
        const stripeWidth = 15;
        const stripeCount = Math.floor(w / stripeWidth);
        
        for (let i = 0; i < stripeCount; i++) {
            if (i % 2 === 0) {
                ctx.fillRect(-w/2 + i * stripeWidth, -h/2, stripeWidth, h);
            }
        }
        
        // 边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-w/2, -h/2, w, h);
        
        // 霓虹光晕
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
        
        // 根据速度轻微倾斜
        const tilt = p.velocityX * 0.5;
        ctx.rotate(tilt * Math.PI / 180);
        
        // 玩家赛车（青色主题）
        this.renderPlayerCar(ctx);
        
        ctx.restore();
    }
    
    renderPlayerCar(ctx) {
        const w = this.player.width;
        const h = this.player.height;
        
        // 车身阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-w/2 + 5, -h/2 + 5, w, h);
        
        // 车身主体（流线型）
        const bodyGradient = ctx.createLinearGradient(-w/2, 0, w/2, 0);
        bodyGradient.addColorStop(0, '#006666');
        bodyGradient.addColorStop(0.3, '#00cccc');
        bodyGradient.addColorStop(0.5, '#00ffff');
        bodyGradient.addColorStop(0.7, '#00cccc');
        bodyGradient.addColorStop(1, '#006666');
        
        ctx.fillStyle = bodyGradient;
        
        // 流线型车身轮廓
        ctx.beginPath();
        // 底部
        ctx.moveTo(-w/3, h/2);
        ctx.lineTo(-w/2, h/3);
        // 左侧
        ctx.lineTo(-w/2, -h/5);
        ctx.lineTo(-w/3, -h/2);
        // 顶部（车头）
        ctx.lineTo(w/3, -h/2);
        // 右侧
        ctx.lineTo(w/2, -h/5);
        ctx.lineTo(w/2, h/3);
        // 回到起点
        ctx.lineTo(w/3, h/2);
        ctx.closePath();
        ctx.fill();
        
        // 车顶
        ctx.fillStyle = '#004444';
        ctx.beginPath();
        ctx.moveTo(-w/4, h/6);
        ctx.lineTo(-w/5, -h/3);
        ctx.lineTo(w/5, -h/3);
        ctx.lineTo(w/4, h/6);
        ctx.closePath();
        ctx.fill();
        
        // 挡风玻璃
        ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
        ctx.beginPath();
        ctx.moveTo(-w/5, h/8);
        ctx.lineTo(-w/6, -h/4);
        ctx.lineTo(w/6, -h/4);
        ctx.lineTo(w/5, h/8);
        ctx.closePath();
        ctx.fill();
        
        // 前灯（白色，强发光）
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;
        
        ctx.beginPath();
        ctx.ellipse(-w/3, -h/2 + 5, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(w/3, -h/2 + 5, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 前灯光束效果
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
        
        // 尾翼
        ctx.fillStyle = '#008888';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        
        // 尾翼主体
        ctx.fillRect(-w/2 - 10, h/2 - 5, w + 20, 8);
        
        // 尾翼支架
        ctx.fillRect(-w/3, h/2 - 15, 5, 15);
        ctx.fillRect(w/3 - 5, h/2 - 15, 5, 15);
        
        ctx.shadowBlur = 0;
        
        // 尾灯（红色）
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.fillRect(-w/2 + 5, h/2 - 10, 12, 6);
        ctx.fillRect(w/2 - 17, h/2 - 10, 12, 6);
        ctx.shadowBlur = 0;
        
        // 霓虹装饰线（车身边缘）
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        
        // 底部霓虹线
        ctx.beginPath();
        ctx.moveTo(-w/2 + 5, h/2);
        ctx.lineTo(w/2 - 5, h/2);
        ctx.stroke();
        
        // 车身侧面霓虹
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
        
        // 车顶霓虹线
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
        
        // 尾气粒子
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
        
        // 碰撞粒子
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

// 初始化游戏
window.addEventListener('load', () => {
    new CarGame();
});
