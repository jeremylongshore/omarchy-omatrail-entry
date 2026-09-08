import QtQuick
import qs.Commons
import "JourneyRules.js" as Journey

Item {
  id: root

  property string profile: "green"
  property string rulesProfile: "omatrail"
  property string difficulty: "normal"
  property bool active: false
  property bool setupVisible: true
  property bool abandonPending: false
  property bool recoveryRequired: false
  property bool reducedMotion: false
  property string pendingRiverChoice: ""
  property int seed: 1848
  property string fontFamily: Style.font.menuFamily
  property var journeyState: Journey.createJourney({ seed: seed, profile: profile, rulesProfile: rulesProfile, difficulty: difficulty })

  readonly property bool greenMode: profile !== "color"
  readonly property color pageColor: greenMode ? "#020603" : "#1a2630"
  readonly property color fieldColor: greenMode ? "#050a06" : "#f5efc7"
  readonly property color inkColor: greenMode ? "#63ff73" : "#1a2630"
  readonly property color brightColor: greenMode ? "#b6ffb9" : "#fff8d8"
  readonly property color mutedColor: greenMode ? "#1f7a35" : "#6b4b32"
  readonly property color accentColor: greenMode ? "#163d1f" : "#d8c06b"
  readonly property var currentStop: Journey.ROUTE[Math.min(Journey.ROUTE.length - 1, journeyState.targetIndex)]
  readonly property string screenName: setupVisible ? "EXPEDITION SETUP" : journeyState.phase.toUpperCase()
  readonly property string activeRulesProfile: setupVisible ? rulesProfile : journeyState.rulesProfile
  readonly property string activeRulesLabel: Journey.rulesProfileLabel(activeRulesProfile)

  signal requestHunt(var config)
  signal journeyChanged(var state)
  signal requestErase()
  signal requestRecovery()

  function namesFromModel() {
    var names = []
    for (var index = 0; index < partyNames.count; index++) names.push(partyNames.get(index).name)
    return names
  }

  function cycle(values, current) {
    var index = values.indexOf(current)
    return values[(index + 1) % values.length]
  }

  function startJourney() {
    root.journeyState = Journey.createJourney({
      seed: root.seed,
      profile: root.profile,
      rulesProfile: root.rulesProfile,
      difficulty: root.difficulty,
      occupation: occupationChoice.textValue,
      departureMonth: monthChoice.monthValue,
      names: root.namesFromModel()
    })
    root.setupVisible = false
    root.journeyChanged(root.journeyState)
  }

  function dispatchAction(action) {
    root.abandonPending = false
    root.pendingRiverChoice = ""
    root.journeyState = Journey.dispatch(root.journeyState, action)
    root.journeyChanged(root.journeyState)
    if (root.journeyState.phase === "hunt") {
      root.requestHunt({
        seed: root.journeyState.huntSeed,
        profile: root.profile,
        difficulty: root.journeyState.difficulty,
        region: root.journeyState.region,
        season: Journey.seasonFor(root.journeyState.month),
        ammo: root.journeyState.inventory.ammunition,
        carryCapacity: Math.max(40, Math.min(200, 220 - root.journeyState.inventory.food)),
        rulesProfile: root.journeyState.rulesProfile,
        journeyHunt: true
      })
    }
  }

  function applyHuntResult(result) {
    root.dispatchAction({ type: "APPLY_HUNT_RESULT", result: result })
  }

  function restoreState(state) {
    if (Journey.validate(state).length) return false
    root.journeyState = Journey.dispatch(state, { type: "SET_PROFILE", value: root.profile })
    root.rulesProfile = state.rulesProfile
    root.difficulty = state.difficulty
    root.setupVisible = false
    return true
  }

  function newSetup() {
    root.requestErase()
    root.seed += 1
    root.setupVisible = true
    root.abandonPending = false
  }

  function primaryAction() {
    if (root.setupVisible) { root.startJourney(); return }
    if (root.journeyState.phase === "store") {
      if (Journey.canDepart(root.journeyState)) root.dispatchAction({ type: "DEPART" })
      return
    }
    if (root.journeyState.phase === "trail") { root.dispatchAction({ type: "TRAVEL" }); return }
    if (root.journeyState.phase === "river" && root.pendingRiverChoice) {
      root.confirmRiverChoice(); return
    }
    if (root.journeyState.phase === "landmark" || root.journeyState.phase === "river-result") {
      root.dispatchAction({ type: "LEAVE_STOP" }); return
    }
    if (root.journeyState.phase === "victory" || root.journeyState.phase === "loss") root.newSetup()
  }

  function chooseIndex(index) {
    if (root.journeyState.phase === "event" && root.journeyState.pendingEvent
      && index >= 0 && index < root.journeyState.pendingEvent.choices.length
      && Journey.eventChoiceAvailable(root.journeyState, root.journeyState.pendingEvent, index))
      root.dispatchAction({ type: "EVENT_CHOICE", index: index })
    else if (root.journeyState.phase === "river" && root.journeyState.river
      && index >= 0 && index < root.journeyState.river.options.length)
      root.pendingRiverChoice = root.journeyState.river.options[index]
  }

  function confirmRiverChoice() {
    if (!root.pendingRiverChoice || !root.journeyState.river
      || root.journeyState.river.options.indexOf(root.pendingRiverChoice) < 0) return
    root.dispatchAction({ type: "RIVER_CHOICE", choice: root.pendingRiverChoice })
  }

  function survivorText() {
    if (!root.journeyState.ending) return ""
    return root.journeyState.ending.survivors.length
      ? root.journeyState.ending.survivors.join(", ") : "None"
  }

  function lossText() {
    if (!root.journeyState.ending || !root.journeyState.ending.losses.length) return "None recorded"
    return root.journeyState.ending.losses.map(function(loss) {
      return loss.name + " (" + loss.reason + ")"
    }).join("; ")
  }

  function resourceText() {
    if (!root.journeyState.ending) return ""
    var resources = root.journeyState.ending.resources
    return "Food " + resources.food + " lb  |  Ammo " + resources.ammunition
      + "  |  Oxen " + resources.oxen + "  |  Clothes " + resources.clothing
      + "  |  Medicine " + resources.medicine + "  |  Parts " + resources.parts
  }

  function dateText() {
    var names = ["", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    return names[Math.min(12, root.journeyState.month)] + " " + root.journeyState.day + ", " + root.journeyState.year
  }

  function partySummary() {
    return Journey.livingParty(root.journeyState) + "/5 TRAVELERS  |  AVG HEALTH " + Journey.totalPartyHealth(root.journeyState)
  }

  onProfileChanged: {
    if (!root.setupVisible) root.dispatchAction({ type: "SET_PROFILE", value: root.profile })
  }

  ListModel {
    id: partyNames
    ListElement { name: "Alex" }
    ListElement { name: "Morgan" }
    ListElement { name: "Sam" }
    ListElement { name: "River" }
    ListElement { name: "Casey" }
  }

  Rectangle { anchors.fill: parent; color: root.fieldColor }

  Column {
    anchors.fill: parent
    spacing: 10

    Row {
      width: parent.width
      height: 54
      spacing: 14

      Column {
        width: parent.width * 0.56
        spacing: 2
        Text {
          width: parent.width
          text: "omaTrail // " + root.screenName
          textFormat: Text.PlainText
          elide: Text.ElideRight
          color: root.inkColor
          font.family: root.fontFamily
          font.pixelSize: 23
          font.bold: true
          font.letterSpacing: 1.5
        }
        Text {
          width: parent.width
          text: (root.greenMode ? "GREEN MONITOR" : "COLOR DELUXE")
            + "  |  " + root.activeRulesLabel.toUpperCase()
          textFormat: Text.PlainText
          elide: Text.ElideRight
          color: root.mutedColor
          font.family: root.fontFamily
          font.pixelSize: 11
          font.letterSpacing: 1
        }
      }

      Column {
        visible: !root.setupVisible
        width: parent.width * 0.40
        spacing: 2
        Text {
          width: parent.width
          horizontalAlignment: Text.AlignRight
          text: root.dateText() + "  |  ACT " + root.journeyState.act + ": " + Journey.ACTS[root.journeyState.act].title.toUpperCase()
          textFormat: Text.PlainText
          elide: Text.ElideLeft
          color: root.inkColor
          font.family: root.fontFamily
          font.pixelSize: 12
          font.bold: true
        }
        Text {
          width: parent.width
          horizontalAlignment: Text.AlignRight
          text: root.partySummary()
          textFormat: Text.PlainText
          elide: Text.ElideLeft
          color: root.mutedColor
          font.family: root.fontFamily
          font.pixelSize: 11
        }
      }
    }

    Rectangle { width: parent.width; height: 2; color: root.inkColor }

    Item {
      width: parent.width
      height: parent.height - 66

      Column {
        visible: root.setupVisible
        anchors.centerIn: parent
        width: Math.min(parent.width, 780)
        spacing: 16

        Text {
          width: parent.width
          text: "FORM A PARTY OF FIVE"
          textFormat: Text.PlainText
          color: root.inkColor
          font.family: root.fontFamily
          font.pixelSize: 18
          font.bold: true
          horizontalAlignment: Text.AlignHCenter
        }

        Row {
          width: parent.width
          spacing: 8
          Repeater {
            model: partyNames
            Rectangle {
              required property int index
              required property string name
              width: (parent.width - 32) / 5
              height: 44
              color: "transparent"
              border.width: input.activeFocus ? 3 : 1
              border.color: root.inkColor
              TextInput {
                id: input
                anchors.fill: parent
                anchors.margins: 8
                text: name
                color: root.inkColor
                selectionColor: root.mutedColor
                selectedTextColor: root.brightColor
                font.family: root.fontFamily
                font.pixelSize: 13
                maximumLength: 24
                horizontalAlignment: TextInput.AlignHCenter
                verticalAlignment: TextInput.AlignVCenter
                onTextEdited: partyNames.setProperty(index, "name", text)
                Accessible.name: "Traveler " + (index + 1) + " name"
              }
            }
          }
        }

        Row {
          anchors.horizontalCenter: parent.horizontalCenter
          spacing: 12
          Text {
            anchors.verticalCenter: parent.verticalCenter
            text: "RULES"
            textFormat: Text.PlainText
            color: root.mutedColor
            font.family: root.fontFamily
            font.pixelSize: 12
            font.bold: true
          }
          OmatrailButton {
            width: 190
            label: "omaTrail"
            selected: root.rulesProfile === "omatrail"
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.rulesProfile = "omatrail"
          }
          OmatrailButton {
            width: 230
            label: "CLASSIC 1978-INSPIRED"
            selected: root.rulesProfile === "classic-1978"
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.rulesProfile = "classic-1978"
          }
        }

        Row {
          anchors.horizontalCenter: parent.horizontalCenter
          spacing: 12
          OmatrailButton {
            id: occupationChoice
            property string textValue: "farmer"
            label: "WORK: " + textValue.toUpperCase()
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: textValue = root.cycle(["farmer", "carpenter", "doctor", "banker"], textValue)
          }
          OmatrailButton {
            id: difficultyChoice
            label: "LEVEL: " + root.difficulty.toUpperCase()
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.difficulty = root.cycle(["easy", "normal", "hard"], root.difficulty)
          }
          OmatrailButton {
            id: monthChoice
            property int monthValue: 4
            label: "LEAVE: " + ["", "", "", "MAR", "APR", "MAY", "JUN"][monthValue]
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: monthValue = monthValue >= 6 ? 3 : monthValue + 1
          }
          OmatrailButton {
            label: root.recoveryRequired ? "START FRESH" : "BEGIN"
            inkColor: root.brightColor; fillColor: root.greenMode ? "#163d1f" : "#a3382f"
            activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: {
              if (root.recoveryRequired) root.requestRecovery()
              else root.startJourney()
            }
          }
        }

        Text {
          width: parent.width
          text: root.recoveryRequired
            ? "The prior save and backup could not be restored. Start Fresh deletes them; press Begin afterward to create a new expedition."
            : Journey.RULE_PROFILES[root.rulesProfile].description
          textFormat: Text.PlainText
          wrapMode: Text.WordWrap
          horizontalAlignment: Text.AlignHCenter
          color: root.mutedColor
          font.family: root.fontFamily
          font.pixelSize: 12
        }
      }

      Column {
        visible: !root.setupVisible && (root.journeyState.phase === "store"
          || (root.journeyState.phase === "landmark" && root.currentStop.type === "fort"))
        anchors.fill: parent
        anchors.margins: 8
        spacing: 9

        Text {
          width: parent.width
          text: (root.journeyState.phase === "store" ? "EAST CAMP OUTFITTER" : root.currentStop.name.toUpperCase() + " TRADE POST")
            + "  |  CASH $" + root.journeyState.cash
          textFormat: Text.PlainText
          elide: Text.ElideRight
          color: root.inkColor
          font.family: root.fontFamily
          font.pixelSize: 17
          font.bold: true
        }

        Repeater {
          model: Journey.itemKeys()
          Row {
            required property string modelData
            width: parent.width
            height: 48
            spacing: 12
            property var itemRule: Journey.ITEMS[modelData]
            property int buySteps: modelData === "food" || modelData === "ammunition" ? 5 : 1
            Text {
              width: 190; anchors.verticalCenter: parent.verticalCenter
              text: parent.itemRule.label.toUpperCase()
              textFormat: Text.PlainText
              elide: Text.ElideRight
              color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 13; font.bold: true
            }
            Text {
              width: 190; anchors.verticalCenter: parent.verticalCenter
              text: "OWN " + root.journeyState.inventory[parent.modelData] + "  |  +" + parent.itemRule.step
                + " FOR $" + Journey.purchaseCost(root.journeyState, parent.modelData, 1)
              textFormat: Text.PlainText
              elide: Text.ElideRight
              color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 12
            }
            OmatrailButton {
              compact: true; label: parent.buySteps === 1 ? "BUY" : "BUY 5X"
              inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
              onClicked: root.dispatchAction({ type: "BUY", item: parent.modelData, steps: parent.buySteps })
            }
            OmatrailButton {
              compact: true; label: "RETURN"
              inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
              onClicked: root.dispatchAction({ type: "SELL", item: parent.modelData, steps: 1 })
            }
          }
        }

        Row {
          width: parent.width; height: 48; spacing: 16
          Text {
            width: parent.width - departButton.width - 16
            anchors.verticalCenter: parent.verticalCenter
            text: root.journeyState.message
            textFormat: Text.PlainText
            elide: Text.ElideRight
            color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 12
          }
          OmatrailButton {
            id: departButton
            label: root.journeyState.phase === "store" ? "DEPART WEST" : "CONTINUE WEST"
            enabled: root.journeyState.phase !== "store" || Journey.canDepart(root.journeyState)
            inkColor: root.brightColor; fillColor: root.greenMode ? "#163d1f" : "#a3382f"
            activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.dispatchAction({ type: root.journeyState.phase === "store" ? "DEPART" : "LEAVE_STOP" })
          }
        }
      }

      Column {
        visible: !root.setupVisible && (root.journeyState.phase === "trail"
          || (root.journeyState.phase === "landmark" && root.currentStop.type !== "fort"))
        anchors.fill: parent
        spacing: 10

        TrailScene {
          width: parent.width
          height: Math.max(160, Math.min(270, parent.height - 250))
          journeyState: root.journeyState
          profile: root.profile
        }

        Row {
          width: parent.width; height: 58; spacing: 6
          Repeater {
            model: root.journeyState.party
            Rectangle {
              required property var modelData
              width: (parent.width - 24) / 5; height: parent.height
              color: "transparent"; border.width: 1; border.color: root.mutedColor
              Column {
                anchors.centerIn: parent; width: parent.width - 8; spacing: 2
                Text { width: parent.width; text: modelData.name; textFormat: Text.PlainText; elide: Text.ElideRight; horizontalAlignment: Text.AlignHCenter; color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 12; font.bold: true }
                Text { width: parent.width; text: modelData.alive ? (modelData.ailment ? modelData.ailment.toUpperCase() : modelData.condition.toUpperCase()) + " " + modelData.health : "LOST"; textFormat: Text.PlainText; elide: Text.ElideRight; horizontalAlignment: Text.AlignHCenter; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 10 }
              }
            }
          }
        }

        Text {
          width: parent.width
          text: root.journeyState.phase === "landmark" ? "ARRIVED: " + root.currentStop.name.toUpperCase() : root.journeyState.message
          textFormat: Text.PlainText
          elide: Text.ElideRight
          color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 13; font.bold: true
        }

        Text {
          width: parent.width
          text: root.journeyState.phase === "landmark" ? root.currentStop.story : Journey.ACTS[root.journeyState.act].theme
          textFormat: Text.PlainText
          elide: Text.ElideRight
          color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11
        }

        Row {
          width: parent.width; height: 44; spacing: 8
          property real actionWidth: (width - spacing * 6) / 7
          OmatrailButton {
            width: parent.actionWidth
            compact: true; label: "PACE: " + root.journeyState.pace.toUpperCase()
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.dispatchAction({ type: "SET_PACE", value: root.cycle(["steady", "strenuous", "grueling"], root.journeyState.pace) })
          }
          OmatrailButton {
            width: parent.actionWidth
            compact: true; label: "FOOD: " + root.journeyState.rations.toUpperCase()
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.dispatchAction({ type: "SET_RATIONS", value: root.cycle(["filling", "meager", "bare"], root.journeyState.rations) })
          }
          OmatrailButton {
            width: parent.actionWidth
            compact: true; label: "REST"
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.dispatchAction({ type: "REST" })
          }
          OmatrailButton {
            width: parent.actionWidth
            compact: true; label: "REPAIR"
            enabled: root.journeyState.inventory.parts > 0 && root.journeyState.wagonCondition < 100
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.dispatchAction({ type: "REPAIR" })
          }
          OmatrailButton {
            width: parent.actionWidth
            compact: true
            label: root.journeyState.rulesProfile === "classic-1978"
              && root.journeyState.lastHuntMile === root.journeyState.miles ? "HUNTED HERE" : "HUNT"
            enabled: Journey.canHunt(root.journeyState)
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.dispatchAction({ type: "BEGIN_HUNT" })
          }
          OmatrailButton {
            width: parent.actionWidth
            compact: true; label: root.abandonPending ? "CONFIRM END" : "END RUN"
            inkColor: root.abandonPending ? root.brightColor : root.inkColor
            fillColor: root.abandonPending ? (root.greenMode ? "#163d1f" : "#a3382f") : "transparent"
            activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: {
              if (root.abandonPending) root.dispatchAction({ type: "ABANDON", confirmed: true })
              else root.abandonPending = true
            }
          }
          OmatrailButton {
            width: parent.actionWidth
            compact: true
            label: root.journeyState.phase === "landmark" ? "CONTINUE" : "TRAVEL"
            inkColor: root.brightColor; fillColor: root.greenMode ? "#163d1f" : "#a3382f"
            activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.dispatchAction({ type: root.journeyState.phase === "landmark" ? "LEAVE_STOP" : "TRAVEL" })
          }
        }

        Text {
          width: parent.width
          text: "FOOD " + root.journeyState.inventory.food + " LB  |  AMMO " + root.journeyState.inventory.ammunition + "  |  OXEN " + root.journeyState.inventory.oxen + "  |  WAGON " + root.journeyState.wagonCondition + "%  |  CASH $" + root.journeyState.cash
          textFormat: Text.PlainText
          elide: Text.ElideRight
          color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11
        }
      }

      Column {
        visible: !root.setupVisible && root.journeyState.phase === "event"
        anchors.centerIn: parent; width: Math.min(parent.width, 720); spacing: 16
        Text { width: parent.width; text: root.journeyState.pendingEvent ? root.journeyState.pendingEvent.title.toUpperCase() : "TRAIL EVENT"; textFormat: Text.PlainText; wrapMode: Text.WordWrap; color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 24; font.bold: true; horizontalAlignment: Text.AlignHCenter }
        Text { width: parent.width; text: root.journeyState.pendingEvent ? root.journeyState.pendingEvent.text : ""; textFormat: Text.PlainText; wrapMode: Text.WordWrap; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 15; horizontalAlignment: Text.AlignHCenter }
        Repeater {
          model: root.journeyState.pendingEvent ? root.journeyState.pendingEvent.choices : []
          OmatrailButton {
            required property int index
            required property string modelData
            anchors.horizontalCenter: parent.horizontalCenter
            width: 360; label: (index + 1) + ". " + modelData.toUpperCase()
            enabled: Journey.eventChoiceAvailable(root.journeyState, root.journeyState.pendingEvent, index)
            inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
            onClicked: root.dispatchAction({ type: "EVENT_CHOICE", index: index })
          }
        }
        Text {
          width: parent.width
          text: root.journeyState.pendingEvent
            ? root.journeyState.pendingEvent.source.toUpperCase().replace("-", " ") + "  |  CHOICE RETURNS TO " + root.journeyState.pendingEvent.destination.toUpperCase()
            : ""
          textFormat: Text.PlainText; elide: Text.ElideRight
          color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 10
          horizontalAlignment: Text.AlignHCenter
        }
      }

      Column {
        visible: !root.setupVisible && root.journeyState.phase === "river"
        anchors.centerIn: parent; width: Math.min(parent.width, 760); spacing: 14
        Text { width: parent.width; text: root.journeyState.river ? root.journeyState.river.name.toUpperCase() : "RIVER"; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 24; font.bold: true; horizontalAlignment: Text.AlignHCenter }
        Text { width: parent.width; text: root.journeyState.river ? "WIDTH " + root.journeyState.river.width + " FT  |  DEPTH " + root.journeyState.river.depth + " FT  |  CURRENT " + root.journeyState.river.current + "/5  |  " + root.journeyState.river.weather.toUpperCase() : ""; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 13; horizontalAlignment: Text.AlignHCenter }
        Text { width: parent.width; text: "Choose with the visible river conditions in mind. Safer services cost cash."; textFormat: Text.PlainText; wrapMode: Text.WordWrap; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 13; horizontalAlignment: Text.AlignHCenter }
        Flow {
          anchors.horizontalCenter: parent.horizontalCenter; width: Math.min(parent.width, 620); spacing: 10
          Repeater {
            model: root.journeyState.river ? root.journeyState.river.options : []
            OmatrailButton {
              required property int index
              required property string modelData
              label: (index + 1) + ". " + modelData.toUpperCase() + (modelData === "ferry" ? " $" + root.journeyState.river.ferryPrice : "")
              inkColor: root.inkColor; activeFillColor: root.accentColor; fontFamily: root.fontFamily
              selected: root.pendingRiverChoice === modelData
              onClicked: root.pendingRiverChoice = modelData
            }
          }
        }
        Text {
          width: parent.width
          text: root.pendingRiverChoice
            ? "ORDER READY: " + root.pendingRiverChoice.toUpperCase() + ". Review the factors, then confirm."
            : "Select a crossing order. Nothing happens until you confirm it."
          textFormat: Text.PlainText; wrapMode: Text.WordWrap
          color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 12
          horizontalAlignment: Text.AlignHCenter
        }
        OmatrailButton {
          anchors.horizontalCenter: parent.horizontalCenter
          label: root.pendingRiverChoice ? "CONFIRM " + root.pendingRiverChoice.toUpperCase() : "CONFIRM CROSSING"
          enabled: root.pendingRiverChoice.length > 0
          inkColor: root.brightColor; fillColor: root.greenMode ? "#163d1f" : "#a3382f"
          activeFillColor: root.accentColor; fontFamily: root.fontFamily
          onClicked: root.confirmRiverChoice()
        }
      }

      Column {
        visible: !root.setupVisible && root.journeyState.phase === "river-result"
        anchors.centerIn: parent; width: Math.min(parent.width, 720); spacing: 16
        Text { width: parent.width; text: root.journeyState.riverResult && root.journeyState.riverResult.success ? "SAFE ACROSS" : "A HARD CROSSING"; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 25; font.bold: true; horizontalAlignment: Text.AlignHCenter }
        Rectangle {
          id: crossingTrace
          anchors.horizontalCenter: parent.horizontalCenter
          width: Math.min(parent.width, 560); height: 64
          color: "transparent"; border.width: 1; border.color: root.mutedColor
          Repeater {
            model: 4
            Rectangle {
              required property int index
              x: 12; y: 10 + index * 14; width: crossingTrace.width - 24; height: 1
              color: root.mutedColor; opacity: 0.45
            }
          }
          Text {
            anchors.centerIn: parent
            width: parent.width - 24
            text: root.journeyState.riverResult && root.journeyState.riverResult.success ? "WAGON  >>>  FAR BANK" : "WAGON  ~~~  WATER"
            textFormat: Text.PlainText; elide: Text.ElideRight
            horizontalAlignment: Text.AlignHCenter; color: root.inkColor
            font.family: root.fontFamily; font.pixelSize: 14; font.bold: true
          }
          Rectangle {
            id: riverCurrent
            x: 8; y: crossingTrace.height - 8; width: 92; height: 3
            color: root.brightColor; opacity: root.reducedMotion ? 0.55 : 0.90
            NumberAnimation on x {
              from: 8; to: crossingTrace.width - riverCurrent.width - 8
              duration: 1200; loops: Animation.Infinite
              running: crossingTrace.visible && !root.reducedMotion
            }
          }
        }
        Text { width: parent.width; text: root.journeyState.riverResult ? root.journeyState.riverResult.explanation + ". Food lost: " + root.journeyState.riverResult.foodLost + " lb. Wagon damage: " + root.journeyState.riverResult.wagonDamage + "%" : ""; textFormat: Text.PlainText; wrapMode: Text.WordWrap; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 14; horizontalAlignment: Text.AlignHCenter }
        OmatrailButton { anchors.horizontalCenter: parent.horizontalCenter; label: "CONTINUE WEST"; inkColor: root.brightColor; fillColor: root.greenMode ? "#163d1f" : "#a3382f"; activeFillColor: root.accentColor; fontFamily: root.fontFamily; onClicked: root.dispatchAction({ type: "LEAVE_STOP" }) }
      }

      Column {
        visible: !root.setupVisible && (root.journeyState.phase === "victory" || root.journeyState.phase === "loss")
        anchors.centerIn: parent; width: Math.min(parent.width, 760); spacing: 14
        Text { width: parent.width; text: root.journeyState.phase === "victory" ? "WEST VALLEY REACHED" : "THE TRAIL ENDS HERE"; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 28; font.bold: true; horizontalAlignment: Text.AlignHCenter }
        Text { width: parent.width; text: root.journeyState.ending ? Journey.rulesProfileLabel(root.journeyState.ending.rulesProfile).toUpperCase() + "  |  SCORE " + root.journeyState.ending.score + "  |  DURATION " + root.journeyState.ending.durationDays + " DAYS  |  LEVEL " + root.journeyState.ending.difficulty.toUpperCase() + "  |  SEED " + root.journeyState.ending.seed : ""; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 14; horizontalAlignment: Text.AlignHCenter }
        Text { width: parent.width; text: "SURVIVORS: " + root.survivorText(); textFormat: Text.PlainText; wrapMode: Text.WordWrap; color: root.inkColor; font.family: root.fontFamily; font.pixelSize: 13; horizontalAlignment: Text.AlignHCenter }
        Text { width: parent.width; text: "LOSSES: " + root.lossText(); textFormat: Text.PlainText; wrapMode: Text.WordWrap; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 12; horizontalAlignment: Text.AlignHCenter }
        Text { width: parent.width; text: root.resourceText(); textFormat: Text.PlainText; wrapMode: Text.WordWrap; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 12; horizontalAlignment: Text.AlignHCenter }
        Text { width: parent.width; text: root.journeyState.ending ? "AVOIDABLE WASTE " + root.journeyState.ending.wastedPounds + " LB" : ""; textFormat: Text.PlainText; elide: Text.ElideRight; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 12; horizontalAlignment: Text.AlignHCenter }
        OmatrailButton { anchors.horizontalCenter: parent.horizontalCenter; label: "NEW EXPEDITION"; inkColor: root.brightColor; fillColor: root.greenMode ? "#163d1f" : "#a3382f"; activeFillColor: root.accentColor; fontFamily: root.fontFamily; onClicked: root.newSetup() }
      }
    }
  }
}
