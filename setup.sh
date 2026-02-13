#!/usr/bin/env fish
sudo pacman -S mkcert python-pip
npm install ws
python -m venv venv
source venv/bin/activate.fish
pip install websockets
mkcert -install
mkcert 127.0.0.1 localhost
