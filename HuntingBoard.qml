import QtQuick
import qs.Commons
import "HuntingRules.js" as Hunt

Item {
  id: root

  property int seed: 1848
  property string profile: "green"
  property string difficulty: "normal"
  property string region: "prairie"
  property string season: "spring"
  property int availableAmmo: 24
  property int carryCapacity: 200
  property bool active: false
  property bool reducedMotion: false
  property string fontFamily: Style.font.family
  property var huntState: Hunt.createHunt(seed, {
    profile: profile,
    difficulty: difficulty,
    region: region,
    season: season,
    ammo: availableAmmo,
    carryCapacity: carryCapacity
  })

  readonly property bool greenMode: profile !== "color"
  readonly property color fieldColor: greenMode ? "#020603" : "#d8c06b"
  readonly property color gridColor: greenMode ? "#14351b" : "#b59a4d"
  readonly property color inkColor: greenMode ? "#63ff73" : "#1a2630"
  readonly property color brightColor: greenMode ? "#b6ffb9" : "#fff4c7"
  readonly property color mutedColor: greenMode ? "#1f7a35" : "#6b4b32"
  readonly property color dangerColor: greenMode ? "#b6ffb9" : "#a3382f"
  readonly property real unitX: width / Hunt.GRID_WIDTH
  readonly property real unitY: height / Hunt.GRID_HEIGHT

  signal huntFinished(var result)

  function reset(nextSeed, options) {
    var actualSeed = nextSeed === undefined ? root.seed : nextSeed
    var config = options || ({})
    root.seed = actualSeed
    root.region = Hunt.canonicalRegion(config.region || root.region)
    root.season = Hunt.canonicalSeason(config.season || root.season)
    root.availableAmmo = Math.max(0, Math.round(Number(config.ammo === undefined ? root.availableAmmo : config.ammo)))
    root.carryCapacity = Math.max(1, Math.round(Number(config.carryCapacity === undefined ? root.carryCapacity : config.carryCapacity)))
    root.huntState = Hunt.createHunt(actualSeed, {
      profile: root.profile,
      difficulty: root.difficulty,
      region: root.region,
      season: root.season,
      ammo: root.availableAmmo,
      carryCapacity: root.carryCapacity,
      assist: config.assist === true || (root.huntState ? root.huntState.assist : false)
    })
  }

  function dispatchAction(action) {
    var previous = root.huntState.phase
    root.huntState = Hunt.dispatch(root.huntState, action)
    if (previous !== "complete" && root.huntState.phase === "complete")
      root.huntFinished({
        carriedPounds: root.huntState.result ? root.huntState.result.carriedPounds : root.huntState.carriedPounds,
        wastedPounds: root.huntState.result ? root.huntState.result.wastedPounds : root.huntState.wastedPounds,
        ammoUsed: root.huntState.initialAmmo - root.huntState.ammo,
        score: root.huntState.score,
        accuracy: Hunt.accuracy(root.huntState),
        harvestedPounds: root.huntState.harvestedPounds,
        spoilagePounds: root.huntState.result ? root.huntState.result.spoilagePounds : 0,
        expeditionDays: root.huntState.result ? root.huntState.result.expeditionDays : 1,
        partyEnergyCost: root.huntState.result ? root.huntState.result.partyEnergyCost : 8,
        injury: root.huntState.result ? root.huntState.result.injury : false,
        riskPercent: root.huntState.result ? root.huntState.result.riskPercent : 0,
        reason: root.huntState.result ? root.huntState.result.reason : "manual"
      })
  }

  function beginOrReturn() {
    if (root.huntState.phase === "complete") return
    else if (root.huntState.returnPending) root.dispatchAction({ type: "FINISH", confirmed: true })
    else root.dispatchAction({ type: "START" })
  }

  function togglePause() { root.dispatchAction({ type: "PAUSE_TOGGLE" }) }
  function move(dx, dy) { root.dispatchAction({ type: "MOVE", dx: dx, dy: dy }) }
  function aim(dx, dy) { root.dispatchAction({ type: "AIM", dx: dx, dy: dy }) }
  function fire() { root.dispatchAction({ type: "FIRE" }) }
  function requestReturn() { root.dispatchAction({ type: "REQUEST_RETURN" }) }
  function toggleAssist() { root.dispatchAction({ type: "SET_ASSIST", enabled: !root.huntState.assist }) }

  onProfileChanged: root.huntState = Hunt.dispatch(root.huntState, { type: "SET_PROFILE", profile: root.profile })
  onActiveChanged: {
    if (!root.active && root.huntState.phase === "playing") root.togglePause()
  }

  Rectangle {
    anchors.fill: parent
    color: root.fieldColor
    border.width: Math.max(1, Math.round(Math.min(root.unitX, root.unitY) * 0.18))
    border.color: root.inkColor
  }

  Repeater {
    model: 14
    Rectangle {
      required property int index
      x: root.unitX
      y: (index * 2 + 2) * root.unitY
      width: root.width - root.unitX * 2
      height: 1
      color: root.gridColor
      opacity: root.greenMode ? 0.34 : 0.28
    }
  }

  Repeater {
    model: root.huntState.obstacles
    Item {
      required property var modelData
      x: modelData.x * root.unitX
      y: modelData.y * root.unitY
      width: Math.max(3, modelData.size * root.unitX)
      height: Math.max(3, modelData.size * root.unitY)

      Rectangle {
        width: parent.width
        height: Math.max(2, root.unitY * 0.22)
        anchors.bottom: parent.bottom
        color: root.mutedColor
      }
      Rectangle {
        width: Math.max(2, root.unitX * 0.18)
        height: parent.height
        anchors.horizontalCenter: parent.horizontalCenter
        color: root.mutedColor
      }
    }
  }

  Repeater {
    model: root.huntState.animals
    Item {
      required property var modelData
      visible: modelData.alive
      x: (modelData.x - 1.2) * root.unitX
      y: (modelData.y - 0.8) * root.unitY
      width: root.unitX * (modelData.species === "bison" ? 3.4 : modelData.species === "deer" ? 2.5 : 1.7)
      height: root.unitY * (modelData.species === "bison" ? 2.0 : 1.5)

      Rectangle {
        x: 0
        y: parent.height * 0.25
        width: parent.width * 0.72
        height: parent.height * 0.50
        color: root.greenMode ? root.inkColor
          : modelData.species === "bison" ? "#5a3a2b"
          : modelData.species === "deer" ? "#9a5f35"
          : modelData.species === "turkey" ? "#294b3b" : "#c98d64"
      }
      Rectangle {
        x: parent.width * 0.68
        y: parent.height * 0.10
        width: parent.width * 0.30
        height: parent.height * 0.38
        color: root.greenMode ? root.brightColor : root.inkColor
      }
      Rectangle {
        x: parent.width * 0.12
        y: parent.height * 0.68
        width: Math.max(2, parent.width * 0.10)
        height: parent.height * 0.32
        color: root.inkColor
      }
      Rectangle {
        x: parent.width * 0.52
        y: parent.height * 0.68
        width: Math.max(2, parent.width * 0.10)
        height: parent.height * 0.32
        color: root.inkColor
      }
    }
  }

  Item {
    id: hunter
    x: (root.huntState.hunter.x - 0.7) * root.unitX
    y: (root.huntState.hunter.y - 0.7) * root.unitY
    width: root.unitX * 1.4
    height: root.unitY * 1.4

    Rectangle {
      anchors.centerIn: parent
      width: Math.max(4, parent.width * 0.58)
      height: Math.max(4, parent.height * 0.58)
      color: root.brightColor
    }
    Rectangle {
      anchors.centerIn: parent
      width: Math.max(2, parent.width * 0.20)
      height: parent.height
      color: root.inkColor
    }
  }

  Rectangle {
    id: scanline
    z: 2
    visible: root.greenMode && root.active && root.huntState.phase === "playing"
    x: 1
    y: 1
    width: Math.max(0, root.width - 2)
    height: Math.max(1, Math.round(root.unitY * 0.10))
    color: root.brightColor
    opacity: root.reducedMotion ? 0.10 : 0.20

    NumberAnimation on y {
      from: 1
      to: Math.max(1, root.height - scanline.height - 1)
      duration: 1800
      loops: Animation.Infinite
      running: scanline.visible && !root.reducedMotion
    }
  }

  Rectangle {
    x: root.huntState.hunter.x * root.unitX
    y: root.huntState.hunter.y * root.unitY
    width: Math.min(root.width * 0.36, root.unitX * 17)
    height: Math.max(1, Math.round(root.unitY * 0.13))
    color: root.dangerColor
    opacity: 0.78
    transformOrigin: Item.Left
    rotation: Math.atan2(root.huntState.aim.y, root.huntState.aim.x) * 180 / Math.PI
  }

  Item {
    x: root.huntState.hunter.x * root.unitX + root.huntState.aim.x * root.unitX * 12 - width / 2
    y: root.huntState.hunter.y * root.unitY + root.huntState.aim.y * root.unitY * 12 - height / 2
    width: Math.max(10, root.unitX * 1.6)
    height: Math.max(10, root.unitY * 1.6)
    Rectangle { anchors.horizontalCenter: parent.horizontalCenter; width: 2; height: parent.height; color: root.dangerColor }
    Rectangle { anchors.verticalCenter: parent.verticalCenter; width: parent.width; height: 2; color: root.dangerColor }
  }

  Rectangle {
    visible: root.huntState.phase !== "playing"
    anchors.centerIn: parent
    width: Math.min(parent.width * 0.72, 540)
    height: Math.min(parent.height * 0.42, 180)
    color: root.greenMode ? "#020603" : "#fff4c7"
    border.width: 3
    border.color: root.inkColor

    Column {
      anchors.centerIn: parent
      width: parent.width - 40
      spacing: 10
      Text {
        width: parent.width
        horizontalAlignment: Text.AlignHCenter
        text: root.huntState.phase === "ready" ? "THE PRAIRIE IS QUIET"
          : root.huntState.phase === "paused" ? "HUNT PAUSED" : "HUNT COMPLETE"
        textFormat: Text.PlainText
        elide: Text.ElideRight
        color: root.inkColor
        font.family: root.fontFamily
        font.pixelSize: 22
        font.bold: true
      }
      Text {
        width: parent.width
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.WordWrap
        text: root.huntState.message
        textFormat: Text.PlainText
        color: root.mutedColor
        font.family: root.fontFamily
        font.pixelSize: 15
      }
      Text {
        width: parent.width
        horizontalAlignment: Text.AlignHCenter
        text: root.huntState.phase === "complete" ? "ENTER: RETURN TO TRAIL"
          : root.huntState.returnPending ? "ENTER: RETURN  |  P: KEEP HUNTING" : "ENTER: CONTINUE"
        textFormat: Text.PlainText
        elide: Text.ElideRight
        color: root.brightColor
        font.family: root.fontFamily
        font.pixelSize: 13
      }
    }
  }

  MouseArea {
    anchors.fill: parent
    acceptedButtons: Qt.LeftButton | Qt.RightButton
    onClicked: function(mouse) {
      var dx = mouse.x / root.unitX - root.huntState.hunter.x
      var dy = mouse.y / root.unitY - root.huntState.hunter.y
      if (mouse.button === Qt.RightButton) root.move(dx, dy)
      else {
        root.aim(dx, dy)
        root.fire()
      }
    }
  }

  Timer {
    interval: 100
    repeat: true
    running: root.active && root.huntState.phase === "playing"
    onTriggered: root.dispatchAction({ type: "TICK" })
  }
}
