document.addEventListener('DOMContentLoaded', () => {
    const minutesDisplay = document.getElementById('minutes');
    const secondsDisplay = document.getElementById('seconds');
    const setMinutesInput = document.getElementById('set-minutes');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const presetBtns = document.querySelectorAll('.preset-btn');
    const audioElement = document.getElementById('alramAudio');

    let countdown; // setInterval ID
    let timeLeft; // 초 단위
    let isPaused = false;
    let initialSetTime = parseInt(setMinutesInput.value) * 60;

    function updateDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        minutesDisplay.textContent = String(minutes).padStart(2, '0');
        secondsDisplay.textContent = String(seconds).padStart(2, '0');
    }

    function startTimer(duration) { // duration in seconds
        if (countdown) clearInterval(countdown); // 기존 타이머 중지

        timeLeft = duration;
        isPaused = false;
        updateDisplay();
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';

        countdown = setInterval(() => {
            if (isPaused) return;

            timeLeft--;
            updateDisplay();

            if (timeLeft <= 0) {
                clearInterval(countdown);
                audioElement.play();
                setTimeout(() => {audioElement.pause(); audioElement.currentTime=0;}, 3000);
                //alert('타이머 종료!');
                // 여기에 알림 소리 재생 등 추가 가능
                resetTimer(initialSetTime); // 종료 후 초기 설정 시간으로 리셋
            }
        }, 1000);
    }

    function pauseTimer() {
        isPaused = true;
        pauseBtn.textContent = '계속';
    }

    function resumeTimer() {
        isPaused = false;
        pauseBtn.textContent = '일시정지';
    }

    function resetTimer(duration = initialSetTime) { // duration in seconds
        clearInterval(countdown);
        timeLeft = duration;
        isPaused = false;
        updateDisplay();
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        pauseBtn.textContent = '일시정지';
    }

    startBtn.addEventListener('click', () => {
        initialSetTime = parseInt(setMinutesInput.value) * 60;
        if (initialSetTime > 0) {
            startTimer(initialSetTime);
        } else {
            alert("시간을 설정해주세요.");
        }
    });

    pauseBtn.addEventListener('click', () => {
        if (isPaused) {
            resumeTimer();
        } else {
            pauseTimer();
        }
    });

    resetBtn.addEventListener('click', () => {
        initialSetTime = parseInt(setMinutesInput.value) * 60;
        resetTimer(initialSetTime);
    });

    presetBtns.forEach(button => {
        button.addEventListener('click', () => {
            const minutes = parseInt(button.dataset.minutes);
            setMinutesInput.value = minutes;
            initialSetTime = minutes * 60;
            resetTimer(initialSetTime); // 프리셋 선택 시 해당 시간으로 리셋
            // startTimer(initialSetTime); // 프리셋 선택 시 바로 시작하고 싶다면 이 줄 활성화
        });
    });

    setMinutesInput.addEventListener('input', () => {
      initialSetTime = parseInt(setMinutesInput.value) * 60;
      if (!countdown) resetTimer();
    });

    // 초기 화면 로드 시 설정된 시간으로 디스플레이 업데이트
    resetTimer(initialSetTime);
});

