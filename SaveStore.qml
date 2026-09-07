import QtQuick
import Quickshell
import Quickshell.Io
import "JourneyRules.js" as Journey

Item {
  id: root

  readonly property string helperPath: Qt.resolvedUrl("bin/omatrail-state").toString().replace("file://", "")
  property string primaryRaw: ""
  property string backupRaw: ""
  property string writeRaw: ""
  property string queuedRaw: ""
  property string primaryProblem: "missing"
  property bool blocked: false
  property bool freshAfterErase: false
  property bool eraseRequested: false
  property string status: "Preparing save storage"

  signal restored(var state, string source)
  signal fresh()
  signal failed(string reason)

  function tryPrimary(code) {
    var parsed = Journey.parseSave(root.primaryRaw)
    if (code === 0 && parsed.valid) {
      root.status = "Journey restored"
      root.restored(parsed.state, "primary")
    } else {
      root.primaryProblem = code === 3 ? "missing" : code === 0 ? parsed.reason : "unsafe"
      backupReader.running = true
    }
  }

  function tryBackup(code) {
    var parsed = Journey.parseSave(root.backupRaw)
    if (code === 0 && parsed.valid) {
      root.status = "Recovered last good journey"
      root.restored(parsed.state, "backup")
      return
    }
    var backupProblem = code === 3 ? "missing" : code === 0 ? parsed.reason : "unsafe"
    if (root.primaryProblem === "missing" && backupProblem === "missing") {
      root.status = "Ready for a new expedition"
      root.fresh()
      return
    }
    root.blocked = true
    root.status = "Save unavailable. Confirm a fresh expedition"
    root.failed(root.status)
  }

  function startWrite(encoded) {
    root.writeRaw = encoded
    writer.stdinEnabled = true
    writer.running = true
  }

  function persist(state) {
    if (root.blocked || root.eraseRequested || eraser.running) return false
    var encoded = Journey.serializeSave(state)
    if (!encoded) {
      root.status = "Save rejected by validation"
      root.failed(root.status)
      return false
    }
    if (writer.running) root.queuedRaw = encoded
    else root.startWrite(encoded)
    return true
  }

  function erase() {
    root.eraseRequested = true
    root.queuedRaw = ""
    if (!writer.running && !eraser.running) eraser.running = true
  }

  function confirmFresh() {
    root.freshAfterErase = true
    root.erase()
  }

  Process {
    id: primaryReader
    command: [root.helperPath, "--read-primary"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.primaryRaw = text
    }
    onExited: function(code) { root.tryPrimary(code) }
  }

  Process {
    id: backupReader
    command: [root.helperPath, "--read-backup"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.backupRaw = text
    }
    onExited: function(code) { root.tryBackup(code) }
  }

  Process {
    id: writer
    command: [root.helperPath, "--write"]
    stdinEnabled: true
    onStarted: {
      writer.write(root.writeRaw)
      writer.stdinEnabled = false
    }
    onExited: function(code) {
      root.status = code === 0 ? "Journey saved" : "Save storage unavailable"
      if (code !== 0) root.failed(root.status)
      if (root.eraseRequested) {
        Qt.callLater(function() { eraser.running = true })
      } else if (root.queuedRaw) {
        var next = root.queuedRaw
        root.queuedRaw = ""
        Qt.callLater(function() { root.startWrite(next) })
      }
    }
  }

  Process {
    id: eraser
    command: [root.helperPath, "--delete"]
    onExited: function(code) {
      root.eraseRequested = false
      root.status = code === 0 ? "Expedition data deleted" : "Could not delete expedition data"
      if (code !== 0) {
        root.freshAfterErase = false
        root.failed(root.status)
      } else {
        root.blocked = false
        if (root.freshAfterErase) {
          root.freshAfterErase = false
          root.fresh()
        }
      }
    }
  }

  Component.onCompleted: primaryReader.running = true
}
