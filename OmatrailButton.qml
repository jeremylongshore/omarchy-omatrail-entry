import QtQuick

Rectangle {
  id: root

  property string label: "ACTION"
  property color inkColor: "#63ff73"
  property color fillColor: "transparent"
  property color activeFillColor: "#163d1f"
  property string fontFamily: "monospace"
  property bool selected: false
  property bool compact: false

  signal clicked()

  implicitWidth: compact ? 96 : 142
  implicitHeight: compact ? 34 : 42
  color: root.selected || tap.pressed ? root.activeFillColor : root.fillColor
  border.width: activeFocus ? 3 : 2
  border.color: root.inkColor
  opacity: enabled ? 1 : 0.42
  focus: true

  Accessible.role: Accessible.Button
  Accessible.name: root.label
  Accessible.focusable: true
  Accessible.onPressAction: if (root.enabled) root.clicked()

  Text {
    anchors.fill: parent
    anchors.margins: 5
    text: root.label
    textFormat: Text.PlainText
    horizontalAlignment: Text.AlignHCenter
    verticalAlignment: Text.AlignVCenter
    elide: Text.ElideRight
    color: root.inkColor
    font.family: root.fontFamily
    font.pixelSize: root.compact ? 11 : 12
    font.bold: true
    font.letterSpacing: 0.5
  }

  TapHandler {
    id: tap
    enabled: root.enabled
    onTapped: root.clicked()
  }

  Keys.onPressed: function(event) {
    if (!root.enabled) return
    if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space) {
      root.clicked()
      event.accepted = true
    }
  }
}
