#!/usr/bin/env ruby
# frozen_string_literal: true

# Applies manual signing to the iOS app target, and only to that target.
#
# The obvious way to sign a release is to pass CODE_SIGN_STYLE and friends to
# xcodebuild on the command line. That does not work here: command line build
# settings apply to every target in the workspace, including the Pods project,
# and a static library or framework cannot carry a provisioning profile:
#
#   error: FirebaseCoreExtension does not support provisioning profiles, but
#   provisioning profile Yosemite Crew App Store has been manually specified.
#
# Writing the settings into the one target that ships means the Pods targets
# keep whatever CocoaPods gave them. The profile name lives inside a secret, so
# it cannot be committed to the project file; this runs on CI just before the
# archive and leaves the checked in project untouched in a normal checkout.

require 'xcodeproj'

project_path, target_name, configuration_name = ARGV
abort 'usage: ios-manual-signing.rb <project.xcodeproj> <target> <configuration>' unless configuration_name

identity = ENV.fetch('SIGNING_IDENTITY')
profile = ENV.fetch('PROFILE_NAME')
team = ENV.fetch('DEVELOPMENT_TEAM')

%w[SIGNING_IDENTITY PROFILE_NAME DEVELOPMENT_TEAM].each do |name|
  abort "#{name} is empty" if ENV.fetch(name).strip.empty?
end

project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |candidate| candidate.name == target_name }
abort "no target named #{target_name} in #{project_path}" unless target

configuration = target.build_configurations.find { |candidate| candidate.name == configuration_name }
abort "target #{target_name} has no #{configuration_name} configuration" unless configuration

settings = configuration.build_settings
settings['CODE_SIGN_STYLE'] = 'Manual'
settings['DEVELOPMENT_TEAM'] = team
settings['PROVISIONING_PROFILE_SPECIFIER'] = profile
settings['CODE_SIGN_IDENTITY'] = identity
# The project level configuration sets an sdk conditional identity. A plain
# target level CODE_SIGN_IDENTITY does not reliably beat it, so set the same
# conditional the project uses.
settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = identity

project.save

puts "#{target_name} / #{configuration_name}:"
%w[CODE_SIGN_STYLE DEVELOPMENT_TEAM PROVISIONING_PROFILE_SPECIFIER CODE_SIGN_IDENTITY CODE_SIGN_IDENTITY[sdk=iphoneos*]].each do |key|
  puts "  #{key} = #{settings[key]}"
end

other_targets = project.targets.reject { |candidate| candidate.name == target_name }
other_targets.each do |candidate|
  candidate.build_configurations.each do |other|
    next unless other.build_settings['PROVISIONING_PROFILE_SPECIFIER']

    abort "#{candidate.name} / #{other.name} also specifies a provisioning profile"
  end
end
