document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 (기존 + 새로 추가된 요소들)
  const globalSequenceModeCheckbox = document.getElementById('globalSequenceModeCheckbox');
  const hoursInput = document.getElementById('hours');
  const minutesInput = document.getElementById('minutes');
  const secondsInput = document.getElementById('seconds');
  const mainTimeInputs = document.getElementById('mainTimeInputs');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const digitalTimeDisplaySpan = document.getElementById('digital-time');
  const timeDisplayContainer = document.getElementById('timeDisplayContainer');
  const pieSlice = document.getElementById('pieSlice');
  const clockElement = document.getElementById('clock');
  const progressSvg = document.getElementById('progressSvg');
  const backgroundCircle = document.getElementById('backgroundCircle');
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValueDisplay = document.getElementById('sizeValue');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeValueDisplay = document.getElementById('volumeValue');
  const toggleTimeDisplayCheckbox = document.getElementById('toggleTimeDisplay');
  const toggleSettingsButton = document.getElementById('toggleSettingsButton');
  const topControlsContainer = document.getElementById('topControlsContainer');
  const currentSequenceDisplay = document.getElementById('currentSequenceDisplay');
  const fullscreenTimerBtn = document.getElementById('fullscreenTimerBtn');
  const mainTimerContainer = document.getElementById('mainTimerContainer');
  const sequenceEditorDiv = document.getElementById('sequenceEditor');
  const sequenceItemsContainer = document.getElementById('sequenceItemsContainer');
  const addSequenceItemBtn = document.getElementById('addSequenceItemBtn');
  const sequenceItemTemplate = document.getElementById('sequenceItemTemplate');
  const autoStartNextSequenceCheckbox = document.getElementById('autoStartNextSequenceCheckbox');
  const alramForEachTimerCheckbox = document.getElementById('alramForEachTimerCheckbox');
  const mainColorPickerContainer = document.getElementById('mainColorPickerContainer');
  const mainColorPickerContainerControlGroup = document.getElementById('mainColorPickerContainerControlGroup');
  const audioElement = document.getElementById('alramAudio');
  const modal = document.getElementById('alram');


  // 상태 변수
  const PRESET_COLORS = ["#E57373", "#81C784", "#64B5F6", "#FFD54F", "#BA68C8", "#FF8A65"];
  const PIE_SLICE_PAUSED_COLOR = '#888888';
  const elementsToHideForFullscreen = [
    topControlsContainer,
    sequenceEditorDiv,
    // mainTimerControls,
    toggleSettingsButton, // also hide the other button in the app-top-buttons group
    currentSequenceDisplay // Hide sequence display text for cleaner timer view
];
  
  let areSettingsVisible = true;
  let currentMainTimerColor = PRESET_COLORS[2]; // 기본 색상

  const originalDisplays = new Map();

  let currentCx, currentCy, currentRadius;
  let BASE_DIGITAL_FONT_SIZE_EM = 3.5;

  let BASE_CLOCK_SIZE = 400;
  let totalDuration = 0, remainingTime = 0;
  let animationFrameId = null, timeoutId = null, timerStartTimeMs = 0, pauseStartTimeMs = 0, accumulatedPausedTimeMs = 0, lastDigitalUpdateTimeMs = 0;
  
  let isTimerGloballyPaused = false; // 전체 앱의 일시정지 상태 (단일/시퀀스 공통)

  let sequenceData = [];
  let currentSequenceIndex = -1;
  let isSequenceActive = false; // 시퀀스가 '재생 중'인 상태 (아이템 하나하나가 아님)
  let autoStartNextSequenceItem = autoStartNextSequenceCheckbox.checked;
  let alramForEachTimer = alramForEachTimerCheckbox.checked;
  let isGlobalSequenceModeEnabled = globalSequenceModeCheckbox.checked;

  // --- 색상 팔레트 생성 함수 ---
  function createColorPalette(containerElement, initialColor, colorChangeCallback) {
      containerElement.innerHTML = ''; // 기존 내용 초기화
      const paletteDiv = document.createElement('div');
      paletteDiv.className = 'color-palette';

      PRESET_COLORS.forEach(color => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'palette-color-btn';
          btn.style.backgroundColor = color;
          btn.dataset.color = color;
          btn.addEventListener('click', () => {
            colorInput.value = btn.dataset.color;
            parent = btn.parentElement;
            for (const child of parent.children) {
              child.style.border = 'unset';
            } btn.style.border = '2px solid ';
            colorChangeCallback(color);
          });
          if (color === initialColor) {
            btn.style.border = '2px solid ';
          }
          paletteDiv.appendChild(btn);
      });

      containerElement.appendChild(paletteDiv);

      const customColorWrapper = document.createElement('div');
      customColorWrapper.className = 'custom-color-input-wrapper';
      const customLabel = document.createElement('label');
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'custom-color-input';
      colorInput.value = initialColor;
      customLabel.textContent = 'Custom:';
      customLabel.appendChild(colorInput); // 레이블이 input을 감싸도록 하거나, for로 연결

      colorInput.addEventListener('input', () => {
          colorChangeCallback(colorInput.value);
      });
      customColorWrapper.appendChild(customLabel);
      containerElement.appendChild(customColorWrapper);
      return colorInput; // input[type=color] 요소를 반환하여 값 접근 용이하게
  }
  
  // 메인 타이머 색상 팔레트 초기화
  const mainColorInputElement = createColorPalette(
      mainColorPickerContainer, currentMainTimerColor, (newColor) => {
        currentMainTimerColor = newColor;
        if (!isSequenceActive && !isTimerGloballyPaused && !animationFrameId) { // 단일 모드 + 정지 상태일 때만 즉시 반영
          updateCurrentTimerVisuals();
        }
      });

  // Returns the circle color for the pie slice.
  function getCurrentPieFillColor() {
      if (isTimerGloballyPaused && !(isSequenceActive && pauseBtn.textContent === "Start next item")) { // "다음 항목 시작" 상태는 정지상태가 아님
           return PIE_SLICE_PAUSED_COLOR;
      }

      // 시퀀스 실행 중이면 현재 아이템 색상, 아니면 메인 타이머 색상
      if (isSequenceActive && currentSequenceIndex >= 0 && currentSequenceIndex < sequenceData.length) {
          return sequenceData[currentSequenceIndex].colorConfig.timerColor;
      }
      return currentMainTimerColor;
  }

  // Math functions
  function polarToCartesian(cX, cY, r, angle) { const aR = (angle - 90) * Math.PI / 180.0; return { x: cX + (r * Math.cos(aR)), y: cY + (r * Math.sin(aR)) };}
  function describeArc(cX, cY, rVal, sA, eA) { const s = polarToCartesian(cX, cY, rVal, eA); const e = polarToCartesian(cX, cY, rVal, sA); const lAF = eA - sA <= 180 ? "0" : "1"; return `M ${cX},${cY} L ${s.x},${s.y} A ${rVal},${rVal} 0 ${lAF} 0 ${e.x},${e.y} Z`;}

  // Update the circle size
  function applySize(scale) {
      const newClockSize = BASE_CLOCK_SIZE * scale;
      const newDigitalFontSize = BASE_DIGITAL_FONT_SIZE_EM * scale;
      clockElement.style.width = `${newClockSize}px`; clockElement.style.height = `${newClockSize}px`;
      progressSvg.setAttribute('width', newClockSize); progressSvg.setAttribute('height', newClockSize);
      progressSvg.setAttribute('viewBox', `0 0 ${newClockSize} ${newClockSize}`);
      currentCx = newClockSize / 2; currentCy = newClockSize / 2; currentRadius = newClockSize / 2;
      backgroundCircle.setAttribute('cx', currentCx); backgroundCircle.setAttribute('cy', currentCy);
      backgroundCircle.setAttribute('r', currentRadius);
      digitalTimeDisplaySpan.style.fontSize = `${newDigitalFontSize}em`;
      updateCurrentTimerVisuals();
  }
    
  // Update the timer status (circle progress).
  function setProgress(percent) {
    if (percent <= 0.01) {
      pieSlice.setAttribute("d", ""); return;
    }
    const tA = percent >= 99.99 ? 359.99 : (percent / 100) * 360;
    if (currentCx !== undefined && currentCy !== undefined && currentRadius !== undefined)
    pieSlice.setAttribute("d", describeArc(currentCx, currentCy, currentRadius, 0, tA));
  }
  
  // Update digital display & document title
  function updateDigitalDisplay() {
      // Update digital display
      const h=String(Math.floor(remainingTime/3600)).padStart(2,'0');
      const m=String(Math.floor((remainingTime%3600)/60)).padStart(2,'0');
      const s=String(remainingTime%60).padStart(2,'0');
      const timeString = `${h}:${m}:${s}`;
      digitalTimeDisplaySpan.textContent = timeString;
      
      // Update document title
      let titlePrefix = "";
      if (isSequenceActive && currentSequenceIndex >= 0 && currentSequenceIndex < sequenceData.length) {
          const currentItem = sequenceData[currentSequenceIndex];
          titlePrefix = currentItem.name ? `${currentItem.name} (${currentSequenceIndex + 1}/${sequenceData.length}) - ` : `Item ${currentSequenceIndex + 1}/${sequenceData.length} - `;
      } else if (isGlobalSequenceModeEnabled) {
          titlePrefix = "Sequence mode - ";
      } else {
          titlePrefix = "Timer - ";
      }
      document.title = `${titlePrefix}${timeString}`;
  }
  
  function updateCurrentTimerVisuals() { 
      let currentProgressPercentForPie;
      if (animationFrameId || isTimerGloballyPaused) { 
          const currentElapsedTimeMs = Date.now() - timerStartTimeMs - accumulatedPausedTimeMs;
          const currentRemainingMs = Math.max(0, (totalDuration * 1000) - currentElapsedTimeMs);
          currentProgressPercentForPie = totalDuration > 0 ? (currentRemainingMs / (totalDuration * 1000)) * 100 : 0;
      } else { 
          currentProgressPercentForPie = totalDuration > 0 ? (remainingTime / totalDuration) * 100 : 0;
          if (totalDuration > 0 && remainingTime === totalDuration && totalDuration > 0) currentProgressPercentForPie = 100; 
      }
      if (isSequenceActive && isTimerGloballyPaused && pauseBtn.textContent === "Start next item") { // 다음 항목 대기중일 때는 파이 안 그림
           setProgress(0);
      } else {
          setProgress(currentProgressPercentForPie);
      }
      pieSlice.style.fill = getCurrentPieFillColor(); 
  }

  // --- 메인 타이머 로직 (애니메이션 루프) ---
  function animationLoop() {
      if (isTimerGloballyPaused || !animationFrameId) return;
      const currentTimeMs = Date.now();
      const elapsedTimeMs = currentTimeMs - timerStartTimeMs - accumulatedPausedTimeMs;
      const currentRemainingMs = (totalDuration * 1000) - elapsedTimeMs;

      if (currentRemainingMs <= 0) { // 타이머 종료 (단일 또는 시퀀스 아이템)
        remainingTime = 0;
        setProgress(0);
        updateDigitalDisplay();
        pieSlice.style.fill = getCurrentPieFillColor(); // 종료 시 색상 유지
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;

        const currentItemName =
            isSequenceActive && sequenceData[currentSequenceIndex] ? 
            (sequenceData[currentSequenceIndex].name || `Item ${currentSequenceIndex + 1}`) : "Timer";

        if (isSequenceActive) { // 시퀀스 아이템 종료
          currentSequenceDisplay.textContent = `${currentItemName} is completed!`;
          if (currentSequenceIndex >= sequenceData.length - 1) { // 모든 시퀀스 완료
            stopSequenceExecution(true); // true: completed
            startSound();
          } else if (autoStartNextSequenceItem) {
            setTimeout(loadNextSequenceItem, 500); // 잠시 후 다음 아이템 로드
            if (alramForEachTimer) {
              startSound(false);
              setTimeout(() => {
                audioElement.pause();
                audioElement.currentTime=0;
              }, 1000);
            }
          } else { // 수동으로 다음 아이템 시작 대기
            isTimerGloballyPaused = true; // "다음 항목 시작" 상태도 일종의 일시정지
            if (alramForEachTimer) {
              startSound(false);
              setTimeout(() => {
                audioElement.pause();
                audioElement.currentTime=0;
              }, 1000);
            }
            // pauseBtn 텍스트는 updateMainControlsState에서 처리
            updateMainControlsState();
            startBtn.disabled = true;
            document.title = `${currentItemName} is completed - Ready for next item`;
          }
        } else { // 단일 타이머 종료
          // setTimeout(alert('타이머 종료!'), 1000);
          startSound();
          document.title="⏰ Time is up! - Timerg";
          resetSingleTimer(); 
        }
        return;
      }

      const currentRemainingSeconds = Math.ceil(currentRemainingMs / 1000);
      if (remainingTime !== currentRemainingSeconds || currentTimeMs - lastDigitalUpdateTimeMs > 800) {
        remainingTime = currentRemainingSeconds;
        updateDigitalDisplay();
        lastDigitalUpdateTimeMs = currentTimeMs;
      }
      pieSlice.style.fill = getCurrentPieFillColor();
      setProgress((currentRemainingMs / (totalDuration * 1000)) * 100);
      animationFrameId = requestAnimationFrame(animationLoop);
  }

  // --- 모드별 타이머 제어 함수 ---
  function startSingleTimer(isResume = false) {
    if (!isResume) {
      const h=parseInt(hoursInput.value)||0, m=parseInt(minutesInput.value)||0, s=parseInt(secondsInput.value)||0;
      totalDuration=(h*3600)+(m*60)+s;
      if(totalDuration<=0){
        alert("Please set the duration.");
        return;
      }
      remainingTime=totalDuration;
      timerStartTimeMs=Date.now();
      accumulatedPausedTimeMs=0;
    // currentMainTimerColor 는 mainColorInputElement.value 로 이미 설정되어 있음
    } else { // 재개
      accumulatedPausedTimeMs += (Date.now() - pauseStartTimeMs);
    }
    isTimerGloballyPaused = false;
    updateDigitalDisplay(); 
    updateCurrentTimerVisuals(); 
    
    lastDigitalUpdateTimeMs=Date.now(); 
    if(animationFrameId) cancelAnimationFrame(animationFrameId); 
    animationFrameId=requestAnimationFrame(animationLoop);
    updateMainControlsState();
  }

  function pauseActiveTimer() {
      if (!animationFrameId || isTimerGloballyPaused) return; // 이미 정지 또는 일시정지 상태면 무시
      isTimerGloballyPaused = true;
      pieSlice.style.fill = PIE_SLICE_PAUSED_COLOR;
      if(animationFrameId) cancelAnimationFrame(animationFrameId);
      // animationFrameId = null; // 재개를 위해 null로 만들지 않음 (reset시에만)
      pauseStartTimeMs = Date.now();
      updateMainControlsState();
  }
  
  function resetSingleTimer() {
      if(animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
      isTimerGloballyPaused = false; accumulatedPausedTimeMs = 0; pauseStartTimeMs = 0; timerStartTimeMs = 0;
      currentMainTimerColor = mainColorInputElement.value; // 리셋 시 메인 색상 피커 값으로

      const h=parseInt(hoursInput.value)||0,m=parseInt(minutesInput.value)||0,s=parseInt(secondsInput.value)||0;
      totalDuration=(h*3600)+(m*60)+s; remainingTime=totalDuration; 
      
      updateDigitalDisplay();
      setProgress(totalDuration > 0 ? 100 : 0); 
      pieSlice.style.fill = getCurrentPieFillColor();  
      updateMainControlsState();
  }

  function addMin(hourEl, minEl, secEl, additionalMin) {
    let prevMin = parseInt(minEl.value);
    minEl.value = prevMin + additionalMin;
    let hour_val = parseInt(hourEl.value);
    while (minEl.value >= 60) {
        minEl.value -= 60;
        hour_val+=1;
    }
    hourEl.value = hour_val;
  }

  // --- 시퀀스 관련 함수 ---
  function addSequenceItem(initialData = null) {
      const itemFragment = sequenceItemTemplate.content.cloneNode(true);
      const sequenceItemDiv = itemFragment.querySelector('.sequence-item');
      const nameInput = sequenceItemDiv.querySelector('.sequence-name');
      const hoursInput = sequenceItemDiv.querySelector('.seq-hours');
      const minutesInput = sequenceItemDiv.querySelector('.seq-minutes');
      const secondsInput = sequenceItemDiv.querySelector('.seq-seconds');
      const colorPickerContainer = sequenceItemDiv.querySelector('.custom-color-picker-container');
      
      let itemColor = initialData ? initialData.color : PRESET_COLORS[sequenceItemsContainer.children.length % PRESET_COLORS.length];

      const itemColorInputElement = createColorPalette(colorPickerContainer, itemColor, (newColor) => {
          itemColor = newColor; // 클로저를 통해 각 아이템의 색상 input과 연결된 변수 업데이트
      });

      if (initialData) {
          nameInput.value = initialData.name || '';
          hoursInput.value = initialData.h || 0;
          minutesInput.value = initialData.m || 0;
          secondsInput.value = initialData.s || 0;
          // itemColor is already set
      }

      let addTimeBtns = sequenceItemDiv.querySelectorAll('.add-time-btn');
      addTimeBtns.forEach(btn => {
        const minutesToAdd = parseInt(btn.textContent.match(/\d+/)[0]);
	btn.addEventListener('click', () => {
          addMin(hoursInput, minutesInput, secondsInput, minutesToAdd);
          updateMainControlsState(); // 초기 버튼 상태 및 UI 설정
        });
      });
      sequenceItemDiv.querySelector('.seq-reset-time-btn').addEventListener('click', () => {
        hoursInput.value = 0;
        minutesInput.value = 0;
        secondsInput.value = 0;
        updateMainControlsState();
      })
      sequenceItemsContainer.appendChild(sequenceItemDiv);
      updateSequenceItemNumbers();
      sequenceItemDiv.querySelector('.removeSequenceItemBtn').addEventListener('click', () => {
          sequenceItemDiv.remove();
          updateSequenceItemNumbers();
      });
       // To access the color input later for collecting data:
      sequenceItemDiv.dataset.colorInputElement = itemColorInputElement; // Not standard but works for reference
                                                                      // Or better, store color directly on a data attribute or JS object.
  }
  function updateSequenceItemNumbers() { /* 이전과 동일 */ const items = sequenceItemsContainer.querySelectorAll('.sequence-item'); items.forEach((item, index) => { item.querySelector('.sequence-item-number').textContent = `Item ${index + 1}`;});}
  addSequenceItemBtn.addEventListener('click', () => addSequenceItem());

  function collectSequenceDataFromUI() {
      sequenceData = [];
      const items = sequenceItemsContainer.querySelectorAll('.sequence-item');
      items.forEach(itemDiv => {
          const name = itemDiv.querySelector('.sequence-name').value.trim();
          const h = parseInt(itemDiv.querySelector('.seq-hours').value) || 0;
          const m = parseInt(itemDiv.querySelector('.seq-minutes').value) || 0;
          const s = parseInt(itemDiv.querySelector('.seq-seconds').value) || 0;
          const duration = (h * 3600) + (m * 60) + s;
          // Get color from the color input associated with this item
          const colorInputElement = itemDiv.querySelector('.custom-color-input'); // 팔레트 함수가 생성한 input
          const timerColor = colorInputElement ? colorInputElement.value : PRESET_COLORS[0];

          if (duration > 0 || duration == 0) {
              sequenceData.push({
                  name: name || `Item ${sequenceData.length + 1}`,
                  duration,
                  colorConfig: { timerColor: timerColor }
              });
          }
      });
  }

  function startSequenceExecution() {
      collectSequenceDataFromUI();
      if (sequenceData.length === 0) { alert("No sequence item to execute."); return; }
      if (sequenceData.some(data => data.duration > 0) !== true) { alert("No valid sequence item. (All is zero duration)"); return;}
      isSequenceActive = true;
      isTimerGloballyPaused = false; // 시퀀스 시작 시 강제로 unpause
      currentSequenceIndex = -1;
      loadNextSequenceItem();
      // updateMainControlsState(); // redundant call
  }

  function loadNextSequenceItem() {
      currentSequenceIndex++;
      if (currentSequenceIndex >= sequenceData.length) { stopSequenceExecution(true); return; }
      
      const item = sequenceData[currentSequenceIndex];
      currentSequenceDisplay.textContent = `${item.name} (${currentSequenceIndex + 1}/${sequenceData.length})`;
      totalDuration = item.duration; remainingTime = item.duration;
      // currentMainTimerColor = item.colorConfig.timerColor; // 시퀀스 아이템 색상 적용
      
      timerStartTimeMs = Date.now(); accumulatedPausedTimeMs = 0; 
      isTimerGloballyPaused = false; // 다음 아이템 시작 시 unpause
      
      updateDigitalDisplay(); 
      updateCurrentTimerVisuals(); // This will use the item's color via getCurrentPieFillColor

      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(animationLoop);
      updateMainControlsState();
  }

  function startSound(enableModal = true) {
    audioElement.play();
    if (enableModal) {
      modal.style.display = "block";
    }
  }

  function stopSequenceExecution(completed = false) {
      isSequenceActive = false;
      isTimerGloballyPaused = false; // 시퀀스 중지 시 일시정지 상태 해제
      if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
      
      if (completed) {
          currentSequenceDisplay.textContent = "🎉 All sequence items is completed! 🎉";
      } else {
          currentSequenceDisplay.textContent = "Sequence is stopped.";
      }
      currentSequenceIndex = -1; // 인덱스 초기화
      
      // 시퀀스 모드 UI 기본 상태로 (시간 00:00:00, 파이 비우기)
      totalDuration = 0; remainingTime = 0;
      updateDigitalDisplay();
      setProgress(0);
      // pieSlice.style.fill = currentMainTimerColor; // 기본색으로
      updateCurrentTimerVisuals(); // 기본색으로 돌아가도록
      updateMainControlsState();
  }
            
  // --- Fullscreen Logic ---
  function toggleTimerFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
      // Store and hide elements
      elementsToHideForFullscreen.forEach(el => {
        if (el) {
          originalDisplays.set(el, el.style.display);
          el.style.display = 'none';
        }
      });

      // Also hide the parent of fullscreenTimerBtn itself
      const appTopButtons = fullscreenTimerBtn.parentElement;
      if (appTopButtons && appTopButtons.classList.contains('app-top-buttons')) {
        if (!elementsToHideForFullscreen.includes(appTopButtons)) { // Avoid double storing if already included
          originalDisplays.set(appTopButtons, appTopButtons.style.display);
          appTopButtons.style.display = 'none';
        }
      }

      const requestFullscreen = mainTimerContainer.requestFullscreen ||
          mainTimerContainer.webkitRequestFullscreen || mainTimerContainer.msRequestFullscreen || mainTimerContainer.mozRequestFullScreen;
      if (requestFullscreen) {
        requestFullscreen.call(mainTimerContainer).then(() => {
          fullscreenTimerBtn.textContent = "Exit the fullscreen";
        }).catch(err => {
          alert(`Fullscreen request failed: ${err.message} (${err.name})`);
          restoreOriginalDisplays(); // Restore if request failed
        });
      } else {
        alert("This browser does not support fullscreen API.");
        restoreOriginalDisplays();
      }
    } else {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exitFullscreen) {
        exitFullscreen.call(document);
        // restoreOriginalDisplays will be called by the 'fullscreenchange' event
      }
    }
  }

  // --- UI 상태 업데이트 함수 ---
  function updateMainControlsState() {
    const timerIsEffectivelyRunning = animationFrameId && !isTimerGloballyPaused;
    const canStartNextSequenceItem =
        isSequenceActive && isTimerGloballyPaused && currentSequenceIndex < sequenceData.length -1;
    
      if (isGlobalSequenceModeEnabled) {
        mainTimeInputs.style.display = 'none'; // 시퀀스 모드 시 메인 시간 입력 숨김
        sequenceEditorDiv.style.display = 'block';
        addSequenceItemBtn.disabled = isSequenceActive; // 시퀀스 실행 중엔 아이템 추가 불가
	document.querySelectorAll('.add-time-btn').forEach(btn => {btn.disabled = isSequenceActive;});
	document.querySelectorAll('.seq-reset-time-btn').forEach(btn => {btn.disabled = isSequenceActive;});
        // autoStartNextSequenceCheckbox.disabled = isSequenceActive;
        sequenceItemsContainer.querySelectorAll(
            'input, button.removeSequenceItemBtn').forEach(el => el.disabled = isSequenceActive);
        
        collectSequenceDataFromUI();
        if (isSequenceActive) {
          startBtn.textContent = "Resume"; // 또는 현재 상태에 따라
          startBtn.disabled = !isTimerGloballyPaused; // 일시정지 상태일 때만 재개 가능
          
          pauseBtn.textContent = canStartNextSequenceItem ? "Start next item" : "❚❚";
          pauseBtn.disabled = !timerIsEffectivelyRunning && !canStartNextSequenceItem;

          resetBtn.textContent = "⟳";
          resetBtn.disabled = false;
        } else { // 시퀀스 모드, 시퀀스 미실행
          startBtn.textContent = "▶︎";
          startBtn.disabled = sequenceData.length === 0;

          pauseBtn.textContent = "❚❚";
          pauseBtn.disabled = true;

          resetBtn.textContent = "⟳"; // 의미상 비활성화
          resetBtn.disabled = true;

          currentSequenceDisplay.textContent = "Sequence is ready, Please click the button to start.";
        }
      } else { // 단일 타이머 모드
        mainTimeInputs.style.display = 'flex';
        sequenceEditorDiv.style.display = 'none'; // 필요시 'block'으로 하여 편집은 가능하게

        if (timerIsEffectivelyRunning) {
          startBtn.textContent = "▶︎";
          startBtn.disabled = true;
        
          pauseBtn.textContent = "❚❚";
          pauseBtn.disabled = false;
        
          resetBtn.textContent = "⟳";
          resetBtn.disabled = false;
        } else if (isTimerGloballyPaused) {
          startBtn.textContent = "Resume";
          startBtn.disabled = false;

          pauseBtn.textContent = "❚❚";
          pauseBtn.disabled = true;

          resetBtn.textContent = "⟳";
          resetBtn.disabled = false;
        } else { // 정지 상태
          startBtn.textContent = "▶︎";
          startBtn.disabled = false;

          pauseBtn.textContent = "❚❚";
          pauseBtn.disabled = true;

          resetBtn.textContent = "⟳";
          resetBtn.disabled = false; // 초기화는 항상 가능 (또는 totalDuration > 0일때만)
        }
        currentSequenceDisplay.textContent = ""; // 단일 모드에서는 시퀀스 표시 없음
      }

      // 전체 타이머 실행 여부에 따른 전역 입력 필드 비활성화
      // const inputsToDisable = [...mainTimeInputs.querySelectorAll('input')];
      // inputsToDisable.forEach(input =>
      //  input.disabled = timerIsEffectivelyRunning || isTimerGloballyPaused || (isGlobalSequenceModeEnabled && !isSequenceActive));

      // 시퀀스 에디터 내 아이템의 입력 필드 비활성화는 isSequenceActive를 따름
      const seqItemInputs = sequenceItemsContainer.querySelectorAll('.sequence-item input');
       seqItemInputs.forEach(input => {input.disabled = isSequenceActive && !input.classList.contains('custom-color-input')});
  }

  // --- 이벤트 리스너 (버튼 통합 로직) ---
  startBtn.addEventListener('click', () => {
    if (isGlobalSequenceModeEnabled) {
      if (!isSequenceActive) { // 시퀀스 시작
        startSequenceExecution();
      } else if (isTimerGloballyPaused) { // 시퀀스 아이템 재개
        // pauseTimer()가 토글하므로, 현재 isTimerGloballyPaused=true일 때 pauseTimer() 호출 시 재개됨
        startSingleTimer(true); // pauseActiveTimer가 isTimerGloballyPaused를 false로 하고 루프 시작
        // accumulatedPausedTimeMs += (Date.now() - pauseStartTimeMs);
        // isTimerGloballyPaused = false;
      }
    } else { // 단일 타이머 모드
      if (!animationFrameId || isTimerGloballyPaused) { // 시작 또는 재개
        startSingleTimer(isTimerGloballyPaused); // isTimerGloballyPaused가 true면 재개
      }
    }
  });

  pauseBtn.addEventListener('click', () => {
      if (pauseBtn.textContent == "Start next item" && !pauseBtn.disabled || isGlobalSequenceModeEnabled && isSequenceActive && isTimerGloballyPaused && currentSequenceIndex < sequenceData.length -1 && !autoStartNextSequenceItem) {
          // "다음 항목 시작" 로직
          loadNextSequenceItem();
      } else if (animationFrameId && !isTimerGloballyPaused) { // 실행 중인 타이머 일시정지
          pauseActiveTimer();
      } else if (isTimerGloballyPaused) { // 일시정지된 타이머 재개 (startBtn의 역할과 중복될 수 있으므로 startBtn으로 유도)
          startSingleTimer(true);
      }
       updateMainControlsState(); // pauseBtn 텍스트 변경("다음 항목 시작")등을 위해 호출
  });

  resetBtn.addEventListener('click', () => {
    if (isGlobalSequenceModeEnabled && isSequenceActive) {
          stopSequenceExecution(false); // 시퀀스 중지
      } else if (!isGlobalSequenceModeEnabled) {
          resetSingleTimer(); // 단일 타이머 초기화
      }
      updateMainControlsState(); // 버튼 상태 업데이트
  });


  // --- 나머지 이벤트 리스너들 (설정, 키보드 등) ---
  globalSequenceModeCheckbox.addEventListener('change', function() {
      isGlobalSequenceModeEnabled = this.checked;
      if (isGlobalSequenceModeEnabled) {
          mainColorPickerContainerControlGroup.style.display = 'none';
          stopSequenceExecution(false);
          if (animationFrameId || isTimerGloballyPaused) { // 단일 타이マー 실행/일시정지 중이었다면 중지
              resetSingleTimer();
          }
      } else { // 단일 모드로 전환
          if (isSequenceActive) { // 시퀀스 실행 중이었다면 중지
              stopSequenceExecution(false);
          }
          resetSingleTimer();
          mainColorPickerContainerControlGroup.style.display = 'block';
      }
      updateMainControlsState();
  });
  sizeSlider.addEventListener('input', function(){
    const scale=parseInt(this.value)/100;
    sizeValueDisplay.textContent=`${this.value}%`;
    applySize(scale);
  });
  volumeSlider.addEventListener('input', function() {
    volumeValueDisplay.textContent=`${this.value}%`;
    audioElement.volume = this.value/100;
  });
  toggleTimeDisplayCheckbox.addEventListener('change', function(){timeDisplayContainer.style.display=this.checked?'block':'none';});
  
  toggleSettingsButton.addEventListener('click', function() {
      areSettingsVisible = !areSettingsVisible;
      topControlsContainer.style.display = areSettingsVisible ? 'flex' : 'none';
      this.textContent = areSettingsVisible ? 'Hide settings' : 'Show settings';
  });
  function isValidKey(key) {
    return key == ' ' || key == 'Space' ||
        key == 'f' || key == 'F' ||
        key == '+' || key == '-' ||
        key == 'Enter' || key == 'Escape';
  }

  document.addEventListener('keydown', (event) => {
    if (modal.style.display !== 'none') {
      if (isValidKey(event.key)) {
        closeModalFunc();
        return;
      }
      return;
    }
    
    if (event.key === ' ' || event.code === 'Space') {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      event.preventDefault();
      // 현재 활성화된 버튼의 동작을 시뮬레이션하는 것이 더 직관적
      if (!startBtn.disabled) startBtn.click(); // 시작/시퀀스시작/재개
      else if (!pauseBtn.disabled) pauseBtn.click(); // 일시정지/재개/다음항목시작
    } else if (event.key === 'f' || event.key === 'F') {
      toggleTimerFullscreen();
    } else if (event.key === '+') {
      const nxtSize = Math.min(200, parseInt(sizeSlider.value) + 10);
      sizeValueDisplay.textContent=`${nxtSize}%`;
      sizeSlider.value = nxtSize;
      applySize(parseInt(sizeSlider.value) / 100);
    } else if (event.key === '_') {
      const nxtSize = Math.max(50, parseInt(sizeSlider.value) - 10);
      sizeValueDisplay.textContent=`${nxtSize}%`;
      sizeSlider.value = nxtSize;
      applySize(parseInt(sizeSlider.value) / 100);
    }
  });
  [hoursInput,minutesInput,secondsInput].forEach(input=>{input.addEventListener('input',()=>{if(input.id==='hours'){if(parseInt(input.value)>99)input.value=99;}else{if(parseInt(input.value)>59)input.value=59;}if(input.value!==""&&parseInt(input.value)<0)input.value=0; if(!isGlobalSequenceModeEnabled) resetSingleTimer();});});
  autoStartNextSequenceCheckbox.addEventListener('change', function() { autoStartNextSequenceItem = this.checked; });
  alramForEachTimerCheckbox.addEventListener('change', function() { alramForEachTimer = this.checked; });

  function restoreOriginalDisplays() {
          elementsToHideForFullscreen.forEach(el => {
              if (el && originalDisplays.has(el)) {
                  el.style.display = originalDisplays.get(el) || '';
              }
          });
           // Restore app-top-buttons display
          const appTopButtons = fullscreenTimerBtn.parentElement;
          if (appTopButtons && appTopButtons.classList.contains('app-top-buttons') && originalDisplays.has(appTopButtons)) {
              appTopButtons.style.display = originalDisplays.get(appTopButtons) || '';
          }

          originalDisplays.clear();
          fullscreenTimerBtn.textContent = "Full screen";
  }

  fullscreenTimerBtn.addEventListener('click', toggleTimerFullscreen);

  document.addEventListener('fullscreenchange', () => {
          if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
              restoreOriginalDisplays();
          }
      });
  document.addEventListener('webkitfullscreenchange', () => { // Safari
      if (!document.webkitFullscreenElement) {
          restoreOriginalDisplays();
      }
  });
    document.addEventListener('msfullscreenchange', () => { // IE/Edge
      if (!document.msFullscreenElement) {
          restoreOriginalDisplays();
      }
  });
  
  function invisibleLoop() {
    animationLoop();
    if (timeoutId) {
      clearTimeout(timeoutId);
    } else return;
    timeoutId = setTimeout(invisibleLoop, 10);
  }

  function closeModalFunc() {
    modal.style.display = 'none';
    audioElement.pause();
    audioElement.currentTime=0;
  }

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // 탭이 비활성화되었을 때의 처리
      if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          // animationFrameId = null;
      }
      if (animationFrameId && !isTimerGloballyPaused) {
          timeoutId = setTimeout(invisibleLoop, 10);
      }
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (animationFrameId && !isTimerGloballyPaused) {
        animationFrameId = requestAnimationFrame(animationLoop);
      }
    }
  });
  
  // ---Modal Logic--- Close modal when click the outside of modal
  window.addEventListener('click', (event) => {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  });
  closeAlram.addEventListener('click', closeModalFunc);
  // --- 초기화 ---
  (() => {
      BASE_CLOCK_SIZE = Math.min(document.documentElement.clientWidth - 60, 400);
      BASE_DIGITAL_FONT_SIZE_EM = 3.5 * BASE_CLOCK_SIZE / 400;

      sizeSlider.value = 100;
      for(let i=11; i<=20; i++) {
        if (document.documentElement.clientWidth - 60 >= 400 * i / 10)
          sizeSlider.max = i*10;
      }
      const initialScale=parseInt(sizeSlider.value)/100; sizeValueDisplay.textContent=`${sizeSlider.value}%`;
      const initialVolume=parseInt(volumeSlider.value)/100; volumeValueDisplay.textContent=`${volumeSlider.value}%`;
      currentMainTimerColor = mainColorInputElement.value; 
      
      topControlsContainer.style.display = areSettingsVisible ? 'flex' : 'none'; 
      toggleSettingsButton.textContent = areSettingsVisible ? 'Hide settings' : 'Show settings';
      autoStartNextSequenceItem = autoStartNextSequenceCheckbox.checked;
      alramForEachTimer = alramForEachTimerCheckbox.checked;
      isGlobalSequenceModeEnabled = globalSequenceModeCheckbox.checked;
      audioElement.volume = initialVolume;
      resetSingleTimer();
      applySize(initialScale);
      updateMainControlsState(); // 초기 버튼 상태 및 UI 설정
      timeDisplayContainer.style.display=toggleTimeDisplayCheckbox.checked?'block':'none';
      addSequenceItem(); // 기본 시퀀스 아이템 하나 추가
      document.title="TimerG(타이머G)";
  })();
});
