#!/bin/bash

ARCH=$(uname -m)
echo $ARCH
FILE="horizon-agent-linux-deb-amd64.tar.gz"
if [ "${ARCH}" = "x86_64" ]
then
 FILE="horizon-agent-linux-deb-amd64.tar.gz"
elif [ "${ARCH}" = "armv7l" ]
then
 FILE="horizon-agent-linux-deb-armhf.tar.gz"
elif [ "${ARCH}" = "aarch64" ]
then
 FILE="horizon-agent-linux-deb-arm64.tar.gz"
else
 FILE="horizon-agent-linux-deb-amd64.tar.gz"
fi

if [ "${port}" = "" ]
then
  port=8888
fi

DOCKER_VER=19.03.8
BASEDIR=$(dirname $0)
echo ${BASEDIR}
cd ${BASEDIR}

if [ "${ARCH}" = "aarch64" ]
then
  echo curl -fsSLO https://download.docker.com/linux/static/stable/aarch64/docker-${DOCKER_VER}.tgz
  curl -fsSLO https://download.docker.com/linux/static/stable/aarch64/docker-${DOCKER_VER}.tgz \
  && tar xzvf docker-${DOCKER_VER}.tgz --strip 1 -C /usr/bin docker/docker \
  && rm docker-${DOCKER_VER}.tgz \
elif [ "${ARCH}" = "x86_64" ]
then
  echo curl -fsSLO https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VER}.tgz
  curl -fsSLO https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VER}.tgz \
  && tar xzvf docker-${DOCKER_VER}.tgz --strip 1 -C /usr/bin docker/docker \
  && rm docker-${DOCKER_VER}.tgz \
fi

#curl -sSL https://github.com/open-horizon/anax/releases/latest/download/agent-install.sh -o agent-install.sh && sudo chmod +x agent-install.sh
echo ${version}
echo ${css}
if [ "${css}" = "true" ]
then
  ./agent-install.sh -i css: -C
elif [ "${version}" = "" ]
then 
  echo curl -sSL https://github.com/open-horizon/anax/releases/latest/download/${FILE} -o ${FILE}
  curl -sSL https://github.com/open-horizon/anax/releases/latest/download/${FILE} -o ${FILE}
  tar -zxvf ${FILE}
  ./agent-install.sh -C
else
  echo curl -sSL https://github.com/open-horizon/anax/releases/download/${version}/${FILE} -o ${FILE} 
  curl -sSL https://github.com/open-horizon/anax/releases/download/${version}/${FILE} -o ${FILE} 
  tar -zxvf ${FILE}
  ./agent-install.sh -C
fi

export HORIZON_URL="http://localhost:8081"

if [ "${HZN_CONFIG_FILE}" != "" ]
then
  echo oh deploy autoUpdateConfigFiles --config_file ${HZN_CONFIG_FILE}
  oh deploy autoUpdateConfigFiles --config_file ${HZN_CONFIG_FILE}
fi

node dist/find-node.js --port=${port}

# watch hzn agreement list    
# oh deploy setup --org $org_id
#docker run -v /var/run/docker.sock:/var/run/docker.sock -ti docker
# echo "Docker login"
# read docker_user
# read -s -p "Password: " password
# docker login --username=$docker_user --password=$password

