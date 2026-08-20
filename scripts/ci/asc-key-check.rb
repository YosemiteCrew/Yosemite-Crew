#!/usr/bin/env ruby
# frozen_string_literal: true

# Asks App Store Connect whether the API key in the release environment still
# authenticates, and prints only the verdict.
#
# `altool --upload-app` fails with "Failed to authenticate for session" and
# nothing else, which is indistinguishable from a network problem, a bad
# archive or a revoked key. The same credentials had already returned 401 from
# listTeams.action during automatic signing. This calls the API directly so the
# answer is a status code rather than a guess.
#
# Nothing secret is printed: the key id and issuer id are described by shape,
# never by value, and the token is never echoed.

require 'base64'
require 'json'
require 'net/http'
require 'openssl'
require 'uri'

def shape(raw)
  value = raw.strip
  return 'empty' if value.empty?

  kind =
    if value.match?(/\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/) then 'uuid'
    elsif value.match?(/\A[A-Z0-9]+\z/) then 'uppercase alphanumeric'
    else 'mixed'
    end
  # A secret pasted with a trailing newline reaches the JWT and fails
  # authentication with no hint of why, so surface the difference.
  extra = raw.length - value.length
  padding = extra.zero? ? '' : ", surrounded by #{extra} whitespace character#{'s' unless extra == 1}"
  "#{value.length} characters, #{kind}#{padding}"
end

raw_key_id = ENV.fetch('KEY_ID', '')
raw_issuer_id = ENV.fetch('ISSUER_ID', '')
key_id = raw_key_id.strip
issuer_id = raw_issuer_id.strip
key_pem = File.read(ENV.fetch('ASC_KEY_PATH'))

puts "key id:    #{shape(raw_key_id)}   (expected 10 characters, uppercase alphanumeric)"
puts "issuer id: #{shape(raw_issuer_id)}   (expected 36 characters, uuid)"
puts "key file:  #{key_pem.include?('BEGIN PRIVATE KEY') ? 'PEM private key' : 'NOT a PEM private key'}"
puts

key = OpenSSL::PKey::EC.new(key_pem)

def b64(data)
  Base64.urlsafe_encode64(data).delete('=')
end

# ES256 wants a raw 64 byte r||s signature. OpenSSL hands back DER, so unpack
# it and left pad each half; a short r or s otherwise shifts the whole thing.
def es256(key, message)
  der = key.sign(OpenSSL::Digest.new('SHA256'), message)
  r, s = OpenSSL::ASN1.decode(der).value.map { |part| part.value.to_s(2) }
  r.rjust(32, "\x00") + s.rjust(32, "\x00")
end

issued = Time.now.to_i
header = {alg: 'ES256', kid: key_id, typ: 'JWT'}
payload = {iss: issuer_id, iat: issued, exp: issued + 300, aud: 'appstoreconnect-v1'}
signing_input = "#{b64(JSON.dump(header))}.#{b64(JSON.dump(payload))}"
token = "#{signing_input}.#{b64(es256(key, signing_input))}"

uri = URI('https://api.appstoreconnect.apple.com/v1/apps?limit=1')
request = Net::HTTP::Get.new(uri)
request['Authorization'] = "Bearer #{token}"
response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(request) }

puts "GET /v1/apps -> HTTP #{response.code}"

if response.code == '200'
  apps = JSON.parse(response.body).fetch('data', [])
  puts "the key authenticates; it can see #{apps.length} app on this page"
  exit 0
end

begin
  JSON.parse(response.body).fetch('errors', []).each do |error|
    puts "  #{error['code']}: #{error['title']}"
    puts "  #{error['detail']}" if error['detail']
  end
rescue JSON::ParserError
  puts '  the response was not JSON'
end

puts
puts 'The key does not authenticate. This is fixed in App Store Connect, not here:'
puts 'Users and Access > Integrations > App Store Connect API. Check that the key is'
puts 'active, that its role can upload builds, and that the issuer id on that page'
puts 'matches the one this job just used, which comes from the release environment'
puts 'secret APP_STORE_CONNECT_ISSUER_ID and arrives here as ISSUER_ID.'
exit 1
