import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import "HuntingRules.js" as Hunt
import "JourneyRules.js" as Journey

Item {
  id: root

  property var shell: null
  property var manifest: null
  property bool opened: false
  property string profile: "green"
  property string difficulty: "normal"
  property bool reducedMotion: false
  property bool aimAssist: false
  property int runSeed: 1848
  property string viewMode: "journey"
  property var pendingHuntResult: null
  property string saveNotice: ""
  property string fontFamily: Style.font.menuFamily

  readonly property var pluginSettings: Hunt.findEntry(
    root.shell ? root.shell.shellConfig : null,
    (root.manifest && root.manifest.id) || "io.github.jeremylongshore.omatrail")

  readonly property bool greenMode: root.profile !== "color"
  readonly property color pageColor: greenMode ? "#020603" : "#1a2630"
  readonly property color cardColor: greenMode ? "#050a06" : "#f5efc7"
  readonly property color inkColor: greenMode ? "#63ff73" : "#1a2630"
  readonly property color brightColor: greenMode ? "#b6ffb9" : "#fff8d8"
  readonly property color mutedColor: greenMode ? "#1f7a35" : "#6b4b32"
  readonly property color accentColor: greenMode ? "#163d1f" : "#a3382f"

  function open(payloadJson) {
    var payload = ({})
    var rawPayload = String(payloadJson || "{}")
    if (rawPayload.length > 4096) rawPayload = "{}"
    try { payload = JSON.parse(rawPayload) } catch (error) { payload = ({}) }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) payload = ({})
    root.profile = Hunt.canonicalProfile(payload.profile || root.pluginSettings.displayMode)
    root.difficulty = Hunt.canonicalDifficulty(payload.difficulty || root.pluginSettings.difficulty)
    root.reducedMotion = payload.reducedMotion === true || root.pluginSettings.reducedMotion === true
    root.aimAssist = payload.aimAssist === true || root.pluginSettings.aimAssist === true
    if (Number.isFinite(Number(payload.seed))) root.runSeed = Math.floor(Number(payload.seed))
    root.opened = true
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() { root.opened = false }
  function toggle() { if (root.opened) root.dismiss(); else root.open("{}") }

  function dismiss() {
    root.close()
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide((root.manifest && root.manifest.id) || "io.github.jeremylongshore.omatrail")
  }

  function toggleProfile() { root.profile = root.greenMode ? "color" : "green" }

  function beginHunt(config) {
    root.pendingHuntResult = null
    root.viewMode = "hunt"
    board.reset(config.seed, {
      region: config.region,
      season: config.season,
      ammo: config.ammo,
      carryCapacity: config.carryCapacity,
      assist: root.aimAssist
    })
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function finishHunt() {
    if (!root.pendingHuntResult) return
    journey.applyHuntResult(root.pendingHuntResult)
    root.pendingHuntResult = null
    root.viewMode = "journey"
  }

  function journeyPrimary() { journey.primaryAction() }

  function primaryAction() {
    if (!root.opened) return "closed"
    if (root.viewMode === "journey") root.journeyPrimary()
    else if (board.huntState.phase === "complete") root.finishHunt()
    else board.beginOrReturn()
    return "ok"
  }

  function huntStartOrResume() {
    if (!root.opened || root.viewMode !== "hunt") return "unavailable"
    if (board.huntState.phase !== "ready"
      && (board.huntState.phase !== "paused" || board.huntState.returnPending))
      return "unavailable"
    board.beginOrReturn()
    return "ok"
  }

  function diagnosticStatus() {
    return JSON.stringify({
      schemaVersion: 1,
      opened: root.opened,
      focused: keyCatcher.activeFocus,
      viewMode: root.viewMode,
      profile: root.profile,
      journey: {
        phase: journey.journeyState.phase,
        seed: journey.journeyState.seed,
        day: journey.journeyState.day,
        miles: journey.journeyState.miles,
        targetIndex: journey.journeyState.targetIndex
      },
      hunt: {
        phase: board.huntState.phase,
        tick: board.huntState.tick
      }
    })
  }

  IpcHandler {
    target: "io.github.jeremylongshore.omatrail"
    function toggle(): string { root.toggle(); return "ok" }
    function summon(payloadJson: string): string { root.open(payloadJson); return "ok" }
    function hide(): string { root.dismiss(); return "ok" }
    function huntStart(): string { return root.huntStartOrResume() }
    function status(): string { return root.diagnosticStatus() }
  }

  SaveStore {
    id: saves
    onRestored: function(state, source) {
      root.difficulty = Hunt.canonicalDifficulty(state.difficulty)
      journey.restoreState(state)
      root.saveNotice = source === "backup" ? "RECOVERED LAST GOOD SAVE" : "JOURNEY RESTORED"
      if (state.phase === "hunt") journey.requestHunt({
        seed: state.huntSeed,
        profile: root.profile,
        difficulty: state.difficulty,
        region: state.region,
        season: Journey.seasonFor(state.month),
        ammo: state.inventory.ammunition,
        carryCapacity: Math.max(40, Math.min(200, 220 - state.inventory.food)),
        journeyHunt: true
      })
    }
    onFresh: {
      journey.recoveryRequired = false
      root.saveNotice = "NEW EXPEDITION READY"
    }
    onFailed: function(reason) { root.saveNotice = reason.toUpperCase() }
    onBlockedChanged: journey.recoveryRequired = blocked
  }

  Timer {
    id: saveTimer
    interval: 250
    repeat: false
    onTriggered: {
      if (!journey.setupVisible) saves.persist(journey.journeyState)
      root.saveNotice = saves.status.toUpperCase()
    }
  }

  PanelWindow {
    id: window
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "omatrail"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle { anchors.fill: parent; color: root.pageColor; opacity: 0.96 }
    MouseArea { anchors.fill: parent; onClicked: root.dismiss() }

    Item {
      id: keyCatcher
      anchors.fill: parent
      focus: true

      Keys.priority: Keys.BeforeItem
      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) {
          if (root.viewMode === "hunt" && board.huntState.phase === "playing") board.togglePause()
          else root.dismiss()
          event.accepted = true
          return
        }
        if (event.key === Qt.Key_V) {
          root.toggleProfile()
          event.accepted = true
          return
        }
        if (root.viewMode === "journey") {
          if (event.key === Qt.Key_Enter || event.key === Qt.Key_Return) {
            root.primaryAction()
            event.accepted = true
            return
          }
          if (event.key >= Qt.Key_1 && event.key <= Qt.Key_5) {
            journey.chooseIndex(event.key - Qt.Key_1)
            event.accepted = true
            return
          }
          return
        }
        if (event.key === Qt.Key_Enter || event.key === Qt.Key_Return) {
          root.primaryAction()
          event.accepted = true
          return
        }
        if (event.key === Qt.Key_Space) { board.fire(); event.accepted = true; return }
        if (event.key === Qt.Key_Left) { board.aim(-1, 0); event.accepted = true; return }
        if (event.key === Qt.Key_Right) { board.aim(1, 0); event.accepted = true; return }
        if (event.key === Qt.Key_Up) { board.aim(0, -1); event.accepted = true; return }
        if (event.key === Qt.Key_Down) { board.aim(0, 1); event.accepted = true; return }
        var key = event.text ? event.text.toLowerCase() : ""
        if (key === "w") board.move(0, -1)
        else if (key === "s") board.move(0, 1)
        else if (key === "a") board.move(-1, 0)
        else if (key === "d") board.move(1, 0)
        else if (key === "p") board.togglePause()
        else if (key === "h") board.toggleAssist()
        else if (key === "q") board.requestReturn()
        else return
        event.accepted = true
      }

      Rectangle {
        id: terminal
        anchors.centerIn: parent
        width: Math.min(parent.width - 48, 1120)
        height: Math.min(parent.height - 48, 760)
        color: root.cardColor
        border.width: root.greenMode ? 2 : 5
        border.color: root.greenMode ? root.inkColor : "#6b4b32"

        MouseArea { anchors.fill: parent; onClicked: {} }

        JourneyView {
          id: journey
          visible: root.viewMode === "journey"
          anchors.fill: parent
          anchors.margins: 20
          profile: root.profile
          difficulty: root.difficulty
          active: root.opened && visible
          reducedMotion: root.reducedMotion
          seed: root.runSeed
          fontFamily: root.fontFamily
          onRequestHunt: function(config) { root.beginHunt(config) }
          onRequestErase: saves.erase()
          onRequestRecovery: saves.confirmFresh()
          onJourneyChanged: function(state) { saveTimer.restart() }
        }

        Column {
          visible: root.viewMode === "hunt"
          anchors.fill: parent
          anchors.margins: 20
          spacing: 12

          Row {
            width: parent.width
            height: 56
            spacing: 14

            Column {
              width: parent.width * 0.56
              spacing: 2
              Text {
                text: "omaTrail // HUNT"
                textFormat: Text.PlainText
                color: root.inkColor
                font.family: root.fontFamily
                font.pixelSize: 25
                font.bold: true
                font.letterSpacing: 2
              }
              Text {
                width: parent.width
                text: root.greenMode ? "GREEN MONITOR FIELD TERMINAL" : "COLOR DELUXE FIELD JOURNAL"
                textFormat: Text.PlainText
                elide: Text.ElideRight
                color: root.mutedColor
                font.family: root.fontFamily
                font.pixelSize: 12
                font.letterSpacing: 1
              }
            }

            Item { width: Math.max(0, parent.width - parent.children[0].width - stats.width - 28); height: 1 }

            Row {
              id: stats
              height: parent.height
              spacing: 18
              Repeater {
                model: [
                  { label: "TIME", value: Hunt.timeText(board.huntState) },
                  { label: "AMMO", value: String(board.huntState.ammo) },
                  { label: "MEAT", value: board.huntState.carriedPounds + " LB" },
                  { label: "AIM", value: Hunt.accuracy(board.huntState) + "%" }
                ]
                Column {
                  required property var modelData
                  width: 54
                  spacing: 1
                  Text { width: parent.width; text: modelData.label; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 10 }
                  Text { width: parent.width; text: modelData.value; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 16; font.bold: true }
                }
              }
            }
          }

          Rectangle { width: parent.width; height: 2; color: root.inkColor }

          HuntingBoard {
            id: board
            width: parent.width
            height: parent.height - 56 - 2 - 86 - parent.spacing * 3
            profile: root.profile
            difficulty: root.difficulty
            active: root.opened && root.viewMode === "hunt"
            reducedMotion: root.reducedMotion
            seed: root.runSeed
            fontFamily: root.fontFamily
            onHuntFinished: function(result) { root.pendingHuntResult = result }
          }

          Row {
            width: parent.width
            height: 86
            spacing: 14

            Column {
              width: parent.width * 0.56
              spacing: 5
              Text { width: parent.width; text: board.huntState.message; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 14; font.bold: true }
              Text { width: parent.width; text: "WASD MOVE  |  ARROWS AIM  |  SPACE FIRE  |  P PAUSE  |  Q RETURN"; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11 }
              Text { width: parent.width; text: "Mouse: right-click move; left-click aim/fire. Light hunting works."; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11 }
            }

            Row {
              height: parent.height
              spacing: 8
              OmatrailButton { compact: true; label: root.greenMode ? "COLOR [V]" : "GREEN [V]"; inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily; onClicked: root.toggleProfile() }
              OmatrailButton { compact: true; label: "ASSIST [H]"; selected: board.huntState.assist; inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily; onClicked: board.toggleAssist() }
              OmatrailButton {
                compact: true
                label: board.huntState.returnPending ? "CONFIRM" : "RETURN [Q]"
                enabled: board.huntState.phase === "playing" || board.huntState.returnPending
                inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
                onClicked: {
                  if (board.huntState.returnPending) board.beginOrReturn()
                  else board.requestReturn()
                }
              }
              OmatrailButton {
                compact: true
                label: board.huntState.phase === "complete" ? "TRAIL"
                  : board.huntState.returnPending ? "KEEP [P]"
                  : board.huntState.phase === "playing" ? "PAUSE [P]"
                  : board.huntState.phase === "paused" ? "RESUME [P]" : "START"
                inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
                onClicked: {
                  if (board.huntState.phase === "complete") root.finishHunt()
                  else if (board.huntState.phase === "playing" || board.huntState.phase === "paused") board.togglePause()
                  else board.beginOrReturn()
                }
              }
            }
          }
        }

        Text {
          anchors.right: parent.right
          anchors.bottom: parent.bottom
          anchors.margins: 7
          width: parent.width * 0.48
          horizontalAlignment: Text.AlignRight
          text: root.saveNotice
          textFormat: Text.PlainText
          elide: Text.ElideLeft
          color: root.mutedColor
          font.family: root.fontFamily
          font.pixelSize: 9
        }
      }
    }
  }
}
