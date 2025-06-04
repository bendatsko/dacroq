#!/bin/bash
cd /srv/dacroq
git pull origin main
sudo systemctl restart dacroq
