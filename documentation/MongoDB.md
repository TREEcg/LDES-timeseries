# Installing MongoDB

https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/

```sh
#public key of mongo db
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
# create list file for mongoDB (LTS 20.0 ubuntu)
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
# Reload local package database
sudo apt-get update
# Install the mongoDB packages
sudo apt-get install -y mongodb-org
```

## Start the MongoDB

```sh
sudo systemctl start mongod
# Check status
sudo systemctl status mongod
```

The status should be `active (running)` and the mongoDB should run on `mongodb://localhost:27017/`.