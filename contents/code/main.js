/*******************************************************************************
 * Better Quick Tiles KWin script
 *
 * This script will allow cyclign through mutliple sizes for each shortcut key
 *
 ******************************************************************************/

/**
 * Holds all modes the window can be in.
 */
var MODES = {
	FLOATING			: 0, //Any position/size not matching those below

	UP_LEFT_ONE_THIRD 	: 1, 	//x = 0, 	y = 0, 		w = 33%, 	h=50%
	UP_LEFT_HALF 		: 2, 	//x = 0, 	y = 0, 		w = 50%, 	h=50%
	UP_LEFT_TWO_THIRD 	: 3, 	//x = 0, 	y = 0, 		w = 66%, 	h=50%

	UP_CENTER_CENTER 	: 4, 	//x = 33%, 	y = 0, 		w = 33%, 	h=50%
	UP_CENTER_FULL 		: 5, 	//x = 0, 	y = 0, 		w = 100%, 	h=50%

	UP_RIGHT_ONE_THIRD 	: 6, 	//x = 66%, 	y = 0, 		w = 33%, 	h=50%
	UP_RIGHT_HALF 		: 7, 	//x = 50%,	y = 0, 		w = 50%, 	h=50%
	UP_RIGHT_TWO_THIRD 	: 8, 	//x = 33%, 	y = 0, 		w = 66%, 	h=50%

	RIGHT_ONE_THIRD 	: 9, 	//x = 66%, 	y = 0, 		w = 33%, 	h=100%
	RIGHT_HALF 		: 10, 	//x = 50%, 	y = 0, 		w = 50%, 	h=100%
	RIGHT_TWO_THIRD 	: 11, 	//x = 33%, 	y = 0, 		w = 66%, 	h=100%

	CENTER_CENTER 		: 12, 	//x = 33%, 	y = 0, 		w = 33%, 	h=100%
	CENTER_FULL 		: 13, 	//x = 0, 	y = 0, 		w = 100%, 	h=100%

	LEFT_ONE_THIRD 		: 14, 	//x = 0, 	y = 0, 		w = 33%, 	h=100%
	LEFT_HALF 		: 15, 	//x = 0, 	y = 0, 		w = 50%, 	h=100%
	LEFT_TWO_THIRD 		: 16, 	//x = 0, 	y = 0, 		w = 66%, 	h=100%

	DOWN_LEFT_ONE_THIRD 	: 17, 	//x = 0, 	y = 50%, 	w = 33%, 	h=50%
	DOWN_LEFT_HALF 		: 18, 	//x = 0,	y = 50%, 	w = 50%, 	h=50%
	DOWN_LEFT_TWO_THIRD 	: 19, 	//x = 0, 	y = 50%, 	w = 66%, 	h=50%

	DOWN_CENTER_CENTER 	: 20, 	//x = 33%, 	y = 50%, 	w = 33%, 	h=50%
	DOWN_CENTER_FULL 	: 21, 	//x = 0, 	y = 50%, 	w = 100%, 	h=50%

	DOWN_RIGHT_ONE_THIRD 	: 22, 	//x = 66%, 	y = 50%, 	w = 33%, 	h=50%
	DOWN_RIGHT_HALF 	: 23, 	//x = 50%, 	y = 50%, 	w = 50%, 	h=50%
	DOWN_RIGHT_TWO_THIRD 	: 24 	//x = 33%, 	y = 50%, 	w = 66%, 	h=50%
};


/**
 * Holds all gird points and sizes (beside left and upper edge which are always 0)
 *
 * updateToCurrentScreen needs to be called to update these points.
 */
var Grid = {
	oneThirdX 	: null,
	halfX 		: null,
	twoThirdX 	: null,

	halfY 		: null,

	oneThirdW 	: null,
	halfW 		: null,
	twoThirdW 	: null,
	fullW 		: null,

	halfH 		: null,
	fullH 		: null,
};

// --- fuzzy compare for mode detection ---
const EPS_ABS = 2;                 // [px] forgive tiny quantization
const EPS_REL = 0.002;             // [fraction] forgive 0.2% rounding

function near(a, b, scale) {
  const eps = Math.max(EPS_ABS, Math.ceil((scale || 1) * EPS_REL));
  return Math.abs(a - b) <= eps;
}

function screenForClient(c) {
  // Prefer the screen under the window center; if cursor is inside the window, use that.
  try {
    const g = c.frameGeometry;
    const center = Qt.point(g.x + Math.floor(g.width/2), g.y + Math.floor(g.height/2));
    const cur = workspace.cursorPos;
    const curInside = (cur.x >= g.x && cur.x < g.x + g.width && cur.y >= g.y && cur.y < g.y + g.height);
    if (workspace.screenAt) return workspace.screenAt(curInside ? cur : center);
  } catch (_) {}
  return workspace.activeScreen; // fallback
}

function workAreaOnScreen(screen, desktop) {
  // MaximizeArea respects panels; PlacementArea can be smaller/weirder. Use MaximizeArea for tiling.
  return workspace.clientArea(KWin.MaximizeArea, screen, desktop);
}

function ensureOnScreen(c, targetScreen) {
  // If KWin still associates the window with another output (common with XWayland/Electron),
  // shift it first so workarea computations & clamping use the target output.
  if (typeof c.screen === "number" && c.screen !== targetScreen && workspace.sendClientToScreen) {
    workspace.sendClientToScreen(c, targetScreen);
  }
}

// Deterministic integer split: sums to 'total', left/top biased (eliminates 1-px seams).
function splitInt(total, parts) {
  const base = Math.floor(total / parts);
  const rem  = total - base * parts;
  const out = new Array(parts);
  for (let i = 0; i < parts; i++) out[i] = base + (i < rem ? 1 : 0);
  return out;
}

/**
 * Updates the points and sizes based on the current active screen
 *
 * Modify this, if you want to move the grid borders
 */
function updateToCurrentScreen(targetScreen) {
  var screenBounds = workAreaOnScreen(targetScreen, workspace.currentDesktop);

  // Thirds (no-gap)
  var thirdsW = splitInt(screenBounds.width, 3);
  Grid.oneThirdX = thirdsW[0];                 // start of middle column
  Grid.twoThirdX = thirdsW[0] + thirdsW[1];    // start of right column

  // Halves (no-gap)
  var halvesW = splitInt(screenBounds.width, 2);
  Grid.halfX = halvesW[0];

  var halvesH = splitInt(screenBounds.height, 2);
  Grid.halfY = halvesH[0];

  Grid.oneThirdW = thirdsW[0];
  Grid.halfW     = halvesW[0];
  Grid.twoThirdW = thirdsW[0] + thirdsW[1];
  Grid.fullW     = screenBounds.width;

  Grid.halfH     = halvesH[0];
  Grid.fullH     = screenBounds.height;
}
/*
function updateToCurrentScreen () {
console.info("Hrw: updateToCurrentScreen () ")
	var screenBounds = getActiveScreenBounds();

	console.info("Screen bounds: "+screenBounds.x+"/"+screenBounds.y+"/"+screenBounds.width+"/"+screenBounds.height);

	Grid.oneThirdX 	= Math.floor(screenBounds.width/3);
	Grid.halfX 	= Math.floor(screenBounds.width/2);
	Grid.twoThirdX 	= Math.floor(screenBounds.width/3*2);

	Grid.halfY 	= Math.floor(screenBounds.height/2);

	Grid.oneThirdW 	= Math.floor(screenBounds.width/3);
	Grid.halfW 	= Math.floor(screenBounds.width/2);
	Grid.twoThirdW 	= Math.floor(screenBounds.width/3*2);
	Grid.fullW 	= screenBounds.width;

	Grid.halfH 	= Math.floor(screenBounds.height/2);
	Grid.fullH 	= screenBounds.height;

	console.info("Grid params:");
	console.info("oneThirdX: "+Grid.oneThirdX);
	console.info("halfX:     "+Grid.halfX);
	console.info("halfY:     "+Grid.halfY);
	console.info("oneThirdW: "+Grid.oneThirdW);
	console.info("halfW:     "+Grid.halfW);
	console.info("twoThirdW: "+Grid.twoThirdW);
	console.info("fullW:     "+Grid.fullW);
	console.info("halfH:     "+Grid.halfH);
	console.info("fullH:     "+Grid.fullH);
}*/


function init() {
console.info("Hrw: init() ")
	console.info("Initializing");
	registerShortcuts();
}

/**
 * Registers all shortcuts this extension does provide
 */
function registerShortcuts() {
console.info("Hrw: registerShortcuts() ")
	console.info("Registering shortcuts");
	var shortcutPrefix = "Better Quick Tiles ";

	registerShortcut(shortcutPrefix + "Up Left", 		shortcutPrefix + "Up Left", 	"Meta+Num+7", upLeft);
	registerShortcut(shortcutPrefix + "Up Center", 		shortcutPrefix + "Up Center", 	"Meta+Num+8", upCenter);
	registerShortcut(shortcutPrefix + "Up Right", 		shortcutPrefix + "Up Right", 	"Meta+Num+9", upRight);
	registerShortcut(shortcutPrefix + "Left", 		shortcutPrefix + "Left", 	"Meta+Num+4", left);
	registerShortcut(shortcutPrefix + "Center", 		shortcutPrefix + "Center", 	"Meta+Num+5", center);
	registerShortcut(shortcutPrefix + "Right", 		shortcutPrefix + "Right", 	"Meta+Num+6", right);
	registerShortcut(shortcutPrefix + "Down Left", 		shortcutPrefix + "Down Left", 	"Meta+Num+1", downLeft);
	registerShortcut(shortcutPrefix + "Down Center", 	shortcutPrefix + "Down Center", "Meta+Num+2", downCenter);
	registerShortcut(shortcutPrefix + "Down Right", 	shortcutPrefix + "Down Right", 	"Meta+Num+3", downRight);

	console.info("Shortcuts registered")
}

/**
 *	Get the bounds of the currently active window relative to the screen it is on.
 *
 *	@returns: QRect containing x,y, width and height fields
 */
function getActiveWindowBounds(targetScreen) {
  var activeWindowBounds = workspace.activeWindow.frameGeometry;
  var screenBounds = getActiveScreenBounds(targetScreen);
  activeWindowBounds.x -= screenBounds.x;
  activeWindowBounds.y -= screenBounds.y;
  return activeWindowBounds;
}


/**
 *	Get the bounds of the screen the currently active window is on
 *
 * 	@returns: QRect containing x,y, width and height fields
 */
function getActiveScreenBounds(targetScreen) {
  return workAreaOnScreen(targetScreen, workspace.currentDesktop);
}



/**
 *  Get the window position mode, the window is currently in.
 *  If it is in no predefine mode the value modes.FLOATING will be returned
 *
 *  @returns: integer One of the values in the variable modes
 */
function getMode() {
  console.info("Hrw: getMode()");
  var windowBounds = getActiveWindowBounds();      // shim supplies target screen
  var screenBounds = getActiveScreenBounds();      // shim supplies target screen
  var S = Math.max(screenBounds.width, screenBounds.height);
  console.info("Window bounds: "+windowBounds.x+"/"+windowBounds.y+"/"+windowBounds.width+"/"+windowBounds.height);

  // --- X classification ---
  var possibleModesX = [];
  if (near(windowBounds.x, 0, S)) {
    possibleModesX.push(
      MODES.UP_LEFT_HALF, MODES.UP_LEFT_ONE_THIRD, MODES.UP_LEFT_TWO_THIRD,
      MODES.UP_CENTER_FULL, MODES.LEFT_HALF, MODES.LEFT_ONE_THIRD,
      MODES.LEFT_TWO_THIRD, MODES.CENTER_FULL, MODES.DOWN_LEFT_HALF,
      MODES.DOWN_LEFT_ONE_THIRD, MODES.DOWN_LEFT_TWO_THIRD, MODES.DOWN_CENTER_FULL
    );
  } else if (near(windowBounds.x, Grid.oneThirdX, S)) {
    possibleModesX.push(
      MODES.UP_RIGHT_TWO_THIRD, MODES.UP_CENTER_CENTER, MODES.RIGHT_TWO_THIRD,
      MODES.CENTER_CENTER, MODES.DOWN_RIGHT_TWO_THIRD, MODES.DOWN_CENTER_CENTER
    );
  } else if (near(windowBounds.x, Grid.halfX, S)) {
    possibleModesX.push(MODES.UP_RIGHT_HALF, MODES.RIGHT_HALF, MODES.DOWN_RIGHT_HALF);
  } else if (near(windowBounds.x, Grid.twoThirdX, S)) {
    possibleModesX.push(MODES.UP_RIGHT_ONE_THIRD, MODES.RIGHT_ONE_THIRD, MODES.DOWN_RIGHT_ONE_THIRD);
  }
  if (possibleModesX.length === 0) return MODES.FLOATING;

  // --- Y classification ---
  var possibleModesY = [];
  if (near(windowBounds.y, 0, S)) {
    possibleModesY.push(
      MODES.UP_LEFT_HALF, MODES.UP_LEFT_ONE_THIRD, MODES.UP_LEFT_TWO_THIRD,
      MODES.UP_CENTER_CENTER, MODES.UP_CENTER_FULL, MODES.UP_RIGHT_HALF,
      MODES.UP_RIGHT_ONE_THIRD, MODES.UP_RIGHT_TWO_THIRD, MODES.LEFT_HALF,
      MODES.LEFT_ONE_THIRD, MODES.LEFT_TWO_THIRD, MODES.RIGHT_HALF,
      MODES.RIGHT_ONE_THIRD, MODES.RIGHT_TWO_THIRD, MODES.CENTER_CENTER,
      MODES.CENTER_FULL
    );
  } else if (near(windowBounds.y, Grid.halfY, S)) {
    possibleModesY.push(
      MODES.DOWN_LEFT_HALF, MODES.DOWN_LEFT_ONE_THIRD, MODES.DOWN_LEFT_TWO_THIRD,
      MODES.DOWN_CENTER_CENTER, MODES.DOWN_CENTER_FULL, MODES.DOWN_RIGHT_HALF,
      MODES.DOWN_RIGHT_ONE_THIRD, MODES.DOWN_RIGHT_TWO_THIRD
    );
  }
  if (possibleModesY.length === 0) return MODES.FLOATING;

  // --- Width classification ---
  var possibleModesW = [];
  if (near(windowBounds.width, Grid.oneThirdW, S)) {
    possibleModesW.push(
      MODES.UP_LEFT_ONE_THIRD, MODES.UP_CENTER_CENTER, MODES.UP_RIGHT_ONE_THIRD,
      MODES.RIGHT_ONE_THIRD, MODES.CENTER_CENTER, MODES.LEFT_ONE_THIRD,
      MODES.DOWN_LEFT_ONE_THIRD, MODES.DOWN_CENTER_CENTER, MODES.DOWN_RIGHT_ONE_THIRD
    );
  } else if (near(windowBounds.width, Grid.halfW, S)) {
    possibleModesW.push(
      MODES.UP_LEFT_HALF, MODES.UP_RIGHT_HALF, MODES.LEFT_HALF, MODES.RIGHT_HALF,
      MODES.DOWN_LEFT_HALF, MODES.DOWN_RIGHT_HALF
    );
  } else if (near(windowBounds.width, Grid.twoThirdW, S)) {
    possibleModesW.push(
      MODES.UP_LEFT_TWO_THIRD, MODES.UP_RIGHT_TWO_THIRD, MODES.LEFT_TWO_THIRD,
      MODES.RIGHT_TWO_THIRD, MODES.DOWN_LEFT_TWO_THIRD, MODES.DOWN_RIGHT_TWO_THIRD
    );
  } else if (near(windowBounds.width, Grid.fullW, S)) {
    possibleModesW.push(MODES.UP_CENTER_FULL, MODES.CENTER_FULL, MODES.DOWN_CENTER_FULL);
  }
  if (possibleModesW.length === 0) return MODES.FLOATING;

  // --- Height classification ---
  var possibleModesH = [];
  if (near(windowBounds.height, Grid.halfH, S)) {
    possibleModesH.push(
      MODES.UP_LEFT_ONE_THIRD, MODES.UP_LEFT_HALF, MODES.UP_LEFT_TWO_THIRD,
      MODES.UP_CENTER_CENTER, MODES.UP_CENTER_FULL, MODES.UP_RIGHT_ONE_THIRD,
      MODES.UP_RIGHT_HALF, MODES.UP_RIGHT_TWO_THIRD, MODES.DOWN_LEFT_ONE_THIRD,
      MODES.DOWN_LEFT_HALF, MODES.DOWN_LEFT_TWO_THIRD, MODES.DOWN_CENTER_CENTER,
      MODES.DOWN_CENTER_FULL, MODES.DOWN_RIGHT_ONE_THIRD, MODES.DOWN_RIGHT_HALF,
      MODES.DOWN_RIGHT_TWO_THIRD
    );
  } else if (near(windowBounds.height, Grid.fullH, S)) {
    possibleModesH.push(
      MODES.LEFT_ONE_THIRD, MODES.LEFT_HALF, MODES.LEFT_TWO_THIRD,
      MODES.CENTER_CENTER, MODES.CENTER_FULL, MODES.RIGHT_ONE_THIRD,
      MODES.RIGHT_HALF, MODES.RIGHT_TWO_THIRD
    );
  }
  if (possibleModesH.length === 0) return MODES.FLOATING;

  // --- Intersection ---
  for (var ix in possibleModesX) {
    var mode = possibleModesX[ix];
    if (possibleModesY.indexOf(mode) > -1 &&
        possibleModesW.indexOf(mode) > -1 &&
        possibleModesH.indexOf(mode) > -1) {
      return mode;
    }
  }
  return MODES.FLOATING;
}


/**
 * Sets the mode for the active window and by that move it to the position for this mode.
 *
 * @param mode: The mode to move the window in
 *
 * @returns: void
 */
function setMode(mode, targetScreen) {
console.info("Hrw: setMode(mode) ")
	console.info("Set mode: "+mode);
	var x,y,w,h;

	//Setting sizes based on the given mode.
	switch (mode) {

		case MODES.UP_LEFT_ONE_THIRD 	:	x=0;			y=0;		w=Grid.oneThirdW;	h=Grid.halfH;	break;
		case MODES.UP_LEFT_HALF 	:	x=0;			y=0;		w=Grid.halfW;		h=Grid.halfH;	break;
		case MODES.UP_LEFT_TWO_THIRD 	:	x=0;			y=0;		w=Grid.twoThirdW;	h=Grid.halfH;	break;

		case MODES.UP_CENTER_CENTER 	:	x=Grid.oneThirdX;	y=0;		w=Grid.oneThirdW;	h=Grid.halfH;	break;
		case MODES.UP_CENTER_FULL 	:	x=0;			y=0;		w=Grid.fullW;		h=Grid.halfH;	break;

		case MODES.UP_RIGHT_ONE_THIRD 	:	x=Grid.twoThirdX;	y=0;		w=Grid.oneThirdW;	h=Grid.halfH;	break;
		case MODES.UP_RIGHT_HALF 	:	x=Grid.halfX;		y=0;		w=Grid.halfW;		h=Grid.halfH;	break;
		case MODES.UP_RIGHT_TWO_THIRD 	:	x=Grid.oneThirdX;	y=0;		w=Grid.twoThirdW;	h=Grid.halfH;	break;

		case MODES.LEFT_ONE_THIRD 	:	x=0;			y=0;		w=Grid.oneThirdW;	h=Grid.fullH;	break;
		case MODES.LEFT_HALF 		:	x=0;			y=0;		w=Grid.halfW;		h=Grid.fullH;	break;
		case MODES.LEFT_TWO_THIRD 	:	x=0;			y=0;		w=Grid.twoThirdW;	h=Grid.fullH;	break;

		case MODES.CENTER_CENTER 	:	x=Grid.oneThirdX;	y=0;		w=Grid.oneThirdW;	h=Grid.fullH;	break;
		case MODES.CENTER_FULL 		:	x=0;			y=0;		w=Grid.fullW;		h=Grid.fullH;	break;

		case MODES.RIGHT_ONE_THIRD 	:	x=Grid.twoThirdX;	y=0;		w=Grid.oneThirdW;	h=Grid.fullH;	break;
		case MODES.RIGHT_HALF 		:	x=Grid.halfX;		y=0;		w=Grid.halfW;		h=Grid.fullH;	break;
		case MODES.RIGHT_TWO_THIRD 	:	x=Grid.oneThirdX;	y=0;		w=Grid.twoThirdW;	h=Grid.fullH;	break;

		case MODES.DOWN_LEFT_ONE_THIRD	:	x=0;			y=Grid.halfY;	w=Grid.oneThirdW;	h=Grid.halfH;	break;
		case MODES.DOWN_LEFT_HALF 	:	x=0;			y=Grid.halfY;	w=Grid.halfW;		h=Grid.halfH;	break;
		case MODES.DOWN_LEFT_TWO_THIRD 	:	x=0;			y=Grid.halfY;	w=Grid.twoThirdW;	h=Grid.halfH;	break;

		case MODES.DOWN_CENTER_CENTER 	:	x=Grid.oneThirdX;	y=Grid.halfY;	w=Grid.oneThirdW;	h=Grid.halfH;	break;
		case MODES.DOWN_CENTER_FULL 	:	x=0;			y=Grid.halfY;	w=Grid.fullW;		h=Grid.halfH;	break;

		case MODES.DOWN_RIGHT_ONE_THIRD :	x=Grid.twoThirdX;	y=Grid.halfY;	w=Grid.oneThirdW;	h=Grid.halfH;	break;
		case MODES.DOWN_RIGHT_HALF 	:	x=Grid.halfX;		y=Grid.halfY;	w=Grid.halfW;		h=Grid.halfH;	break;
		case MODES.DOWN_RIGHT_TWO_THIRD :	x=Grid.oneThirdX;	y=Grid.halfY;	w=Grid.twoThirdW;	h=Grid.halfH;	break;

		default:	break;
	}

	console.info("New bounds: "+x+"/"+y+"/"+w+"/"+h);

	//Calulating the new window frame geometry relative to the active screen
      var screenBounds = getActiveScreenBounds(targetScreen);
      var newFrameGeometry = {
        x: x + screenBounds.x,
        y: y + screenBounds.y,
        width: w,
        height: h
      };

      var win = workspace.activeWindow;
      if (!win) return;
      win.setMaximize(false, false);
      win.frameGeometry = newFrameGeometry;
}


/**
 * Updates the window position based on the start mode and the mode mapping for repeated key presses.
 *
 * It will get the current mode. Then see if this is one of the modes in the nextModeMap.
 * If that is the case, the mode in the nextModeMap will be appied, if not, the startMode will be applied.
 *
 * @param startMode: The mode the window should be put in, if it is in no valid according to the nextModeMap
 * @param nextModeMap: The mapping of which mode leads to which next mode on repeated key press.
 *
 * @returns void
 */
function updateWindowPosition(startMode, nextModeMap) {
  var c = workspace.activeWindow;
  if (!c || !c.moveable || !c.resizeable) return;
  c.setMaximize(false,false);
  if (!c) return;

  // Decide the output and align KWin's internal association
  var targetScreen = screenForClient(c);
  ensureOnScreen(c, targetScreen);

  // Build grid for that output
  updateToCurrentScreen(targetScreen);

  // Mode detection (use the same target screen for bounds)
  var currentMode = (function(){
    // reuse original getMode logic but ensure it references the same target screen
    // Quick shim: temporarily override helpers
    var _getActiveWindowBounds = getActiveWindowBounds;
    var _getActiveScreenBounds = getActiveScreenBounds;
    try {
      getActiveWindowBounds = function(){ return _getActiveWindowBounds(targetScreen); };
      getActiveScreenBounds = function(){ return _getActiveScreenBounds(targetScreen); };
      return getMode();
    } finally {
      getActiveWindowBounds = _getActiveWindowBounds;
      getActiveScreenBounds = _getActiveScreenBounds;
    }
  })();

  var nextMode = nextModeMap[currentMode];
  if (nextMode === undefined) nextMode = startMode;

  // Apply on the same output
  setMode(nextMode, targetScreen);
}




/**
 * All shortcut handlers
 */
function upLeft() {
console.info("Hrw: upLeft() ")
	console.info("Up left pressed");
	//If the window is not in any valid up left position yet,
	//this is the first position the window will be put in
	var startMode = MODES.UP_LEFT_HALF;

	//This is mapping a previous valid position to the next valid one in case of repeated key presses
	var nextModeMap = {};
	nextModeMap[MODES.UP_LEFT_HALF] = MODES.UP_LEFT_ONE_THIRD;
	nextModeMap[MODES.UP_LEFT_ONE_THIRD] = MODES.UP_LEFT_TWO_THIRD;
	nextModeMap[MODES.UP_LEFT_TWO_THIRD] = MODES.UP_LEFT_HALF;

	//Update the window position
	updateWindowPosition(startMode, nextModeMap);
}

function upCenter() {
console.info("Hrw: upCenter() ")
	var startMode = MODES.UP_CENTER_CENTER;

	var nextModeMap = {};
	nextModeMap[MODES.UP_CENTER_CENTER] = MODES.UP_CENTER_FULL;
	nextModeMap[MODES.UP_CENTER_FULL] = MODES.UP_CENTER_CENTER;

	updateWindowPosition(startMode, nextModeMap);
}

function upRight() {
console.info("Hrw: upRight() ")
	var startMode = MODES.UP_RIGHT_HALF;

	var nextModeMap = {};
	nextModeMap[MODES.UP_RIGHT_HALF] = MODES.UP_RIGHT_ONE_THIRD;
	nextModeMap[MODES.UP_RIGHT_ONE_THIRD] = MODES.UP_RIGHT_TWO_THIRD;
	nextModeMap[MODES.UP_RIGHT_TWO_THIRD] = MODES.UP_RIGHT_HALF;

	updateWindowPosition(startMode, nextModeMap);
}

function left() {
console.info("Hrw: left() ")
	var startMode = MODES.LEFT_HALF;

	var nextModeMap = {};
	nextModeMap[MODES.LEFT_HALF] = MODES.LEFT_ONE_THIRD;
	nextModeMap[MODES.LEFT_ONE_THIRD] = MODES.LEFT_TWO_THIRD;
	nextModeMap[MODES.LEFT_TWO_THIRD] = MODES.LEFT_HALF;

	updateWindowPosition(startMode, nextModeMap);
}

function center() {
console.info("Hrw: center() ")
	var startMode = MODES.CENTER_FULL;

	var nextModeMap = {};
	nextModeMap[MODES.CENTER_FULL] = MODES.CENTER_CENTER;
	nextModeMap[MODES.CENTER_CENTER] = MODES.CENTER_FULL;

	updateWindowPosition(startMode, nextModeMap);
}

function right() {
console.info("Hrw: right() ")
	var startMode = MODES.RIGHT_HALF;

	var nextModeMap = {};
	nextModeMap[MODES.RIGHT_HALF] = MODES.RIGHT_ONE_THIRD;
	nextModeMap[MODES.RIGHT_ONE_THIRD] = MODES.RIGHT_TWO_THIRD;
	nextModeMap[MODES.RIGHT_TWO_THIRD] = MODES.RIGHT_HALF;

	updateWindowPosition(startMode, nextModeMap);
}

function downLeft() {
console.info("Hrw: downLeft() ")
	var startMode = MODES.DOWN_LEFT_HALF;

	var nextModeMap = {};
	nextModeMap[MODES.DOWN_LEFT_HALF] = MODES.DOWN_LEFT_ONE_THIRD;
	nextModeMap[MODES.DOWN_LEFT_ONE_THIRD] = MODES.DOWN_LEFT_TWO_THIRD;
	nextModeMap[MODES.DOWN_LEFT_TWO_THIRD] = MODES.DOWN_LEFT_HALF;

	updateWindowPosition(startMode, nextModeMap);
}

function downCenter() {
console.info("Hrw: downCenter() ")
	var startMode = MODES.DOWN_CENTER_CENTER;

	var nextModeMap = {};
	nextModeMap[MODES.DOWN_CENTER_CENTER] = MODES.DOWN_CENTER_FULL;
	nextModeMap[MODES.DOWN_CENTER_FULL] = MODES.DOWN_CENTER_CENTER;

	updateWindowPosition(startMode, nextModeMap);
}

function downRight() {
console.info("Hrw: downRight() ")
	var startMode = MODES.DOWN_RIGHT_HALF;

	var nextModeMap = {};
	nextModeMap[MODES.DOWN_RIGHT_HALF] = MODES.DOWN_RIGHT_ONE_THIRD;
	nextModeMap[MODES.DOWN_RIGHT_ONE_THIRD] = MODES.DOWN_RIGHT_TWO_THIRD;
	nextModeMap[MODES.DOWN_RIGHT_TWO_THIRD] = MODES.DOWN_RIGHT_HALF;

	updateWindowPosition(startMode, nextModeMap);
}

console.info('starting')
init()
