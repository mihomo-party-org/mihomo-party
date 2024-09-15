cask "mihomo-party" do
  arch arm: "arm64", intel: "x64"

  version "1.2.18"
  sha256 arm:   "b66dfafc843783de76ab4b92fd3af61cf71ce0c067a08bb16232fa00b97919fc",
         intel: "831721b067c44bf552aced33b85ba93c48b39ca4ddf2ec92cf3b5c58d685d8ce"

  url "https://github.com/mihomo-party-org/mihomo-party/releases/download/#{version}/mihomo-party-macos-#{version}-#{arch}.dmg"
  name "mihomo-party"
  desc "Another Mihomo GUI."
  homepage "https://github.com/mihomo-party-org/mihomo-party"

  app "mihomo-party.app"
  binary "#{appdir}/mihomo-party.app/Contents/MacOS/mihomo-party"
end