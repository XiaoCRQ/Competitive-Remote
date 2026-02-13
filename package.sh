#!/usr/bin/env bash
sudo timedatectl set-ntp true
sudo timedatectl status
cd plugin
rm web-ext-artifacts -rf
npx web-ext build
npx web-ext sign --channel=unlisted --api-secret=3cc82015bf3d30e92eb752335aff3cb858a89196c2753139114dff788a4c5f4a --api-key=user:19738953:471
