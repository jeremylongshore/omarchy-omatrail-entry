import QtQuick
import qs.Commons
import qs.Ui

// The bar is a trailhead, not a second copy of the game. It summons the
// fullscreen overlay and does no work while the game is hidden.
BarWidget {
  id: root
  moduleName: "io.github.jeremylongshore.omatrail"

  function toggleOverlay() {
    if (root.bar && root.bar.shell && typeof root.bar.shell.toggle === "function")
      root.bar.shell.toggle(root.moduleName, "{}")
  }

  visible: true
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "omaTrail"
    fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
    active: false
    tooltipText: "Open omaTrail"
    Accessible.role: Accessible.Button
    Accessible.name: "Open omaTrail"

    onPressed: function(buttonCode) { root.toggleOverlay() }
  }
}
