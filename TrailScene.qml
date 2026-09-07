import QtQuick
import "JourneyRules.js" as Journey

Item {
  id: root

  property var journeyState: Journey.createJourney({ seed: 1848 })
  property string profile: "green"

  readonly property bool greenMode: profile !== "color"
  readonly property color skyColor: greenMode ? "#020603" : "#84a7a4"
  readonly property color groundColor: greenMode ? "#071208" : "#d8c06b"
  readonly property color farColor: greenMode ? "#14351b" : "#6b7b68"
  readonly property color inkColor: greenMode ? "#63ff73" : "#1a2630"
  readonly property color brightColor: greenMode ? "#b6ffb9" : "#fff4c7"
  readonly property color accentColor: greenMode ? "#1f7a35" : "#a3382f"
  readonly property real progress: Math.max(0, Math.min(1, journeyState.miles / Journey.ROUTE[Journey.ROUTE.length - 1].mile))

  clip: true

  Rectangle { anchors.fill: parent; color: root.skyColor }

  Rectangle {
    x: parent.width * 0.76
    y: parent.height * 0.12
    width: 44
    height: 44
    radius: 22
    color: root.greenMode ? "transparent" : "#fff4c7"
    border.width: root.greenMode ? 2 : 0
    border.color: root.inkColor
  }

  Repeater {
    model: 5
    Rectangle {
      required property int index
      x: index * root.width * 0.23 - root.width * 0.08
      y: root.height * (0.42 - (index % 2) * 0.06)
      width: root.width * 0.36
      height: root.height * 0.34
      color: root.farColor
      rotation: index % 2 ? -9 : 8
    }
  }

  Rectangle {
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    height: parent.height * 0.42
    color: root.groundColor
  }

  Repeater {
    model: 9
    Rectangle {
      required property int index
      x: index * root.width / 8 - 2
      y: root.height * 0.67 + (index % 3) * 7
      width: 3
      height: 18 + (index % 2) * 10
      color: root.accentColor
      rotation: index % 2 ? 12 : -10
    }
  }

  Item {
    id: wagon
    x: 40 + (root.width - 190) * root.progress
    y: Math.max(8, root.height - height - 36)
    width: 118
    height: 82

    Rectangle {
      x: 18; y: 18; width: 76; height: 42
      radius: root.greenMode ? 0 : 20
      color: root.greenMode ? "transparent" : root.brightColor
      border.width: 4; border.color: root.inkColor
    }
    Rectangle { x: 14; y: 50; width: 92; height: 9; color: root.inkColor }
    Rectangle { x: 98; y: 52; width: 38; height: 4; color: root.inkColor; rotation: -7 }
    Rectangle { x: 24; y: 53; width: 25; height: 25; radius: 13; color: root.groundColor; border.width: 4; border.color: root.inkColor }
    Rectangle { x: 74; y: 53; width: 25; height: 25; radius: 13; color: root.groundColor; border.width: 4; border.color: root.inkColor }
  }

  Column {
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    anchors.margins: 12
    spacing: 4
    Text {
      width: parent.width
      text: Math.round(root.journeyState.miles) + " / " + Journey.ROUTE[Journey.ROUTE.length - 1].mile + " MILES"
      textFormat: Text.PlainText
      elide: Text.ElideRight
      color: root.inkColor
      font.family: "monospace"
      font.pixelSize: 11
      font.bold: true
    }
    Rectangle {
      width: parent.width
      height: 7
      color: "transparent"
      border.width: 1
      border.color: root.inkColor
      Rectangle { width: parent.width * root.progress; height: parent.height; color: root.inkColor }
    }
  }
}
