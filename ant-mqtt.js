/* 
    MQTT-Broker client test
    Based on https://infinityflow.ch/raspberry-pi-ant/
 
    mqtt https://www.npmjs.com/package/mqtt
*/

// Requires
const {
    HeartRateSensor,
    CadenceSensor,
    SpeedSensor,
    SpeedCadenceSensor,
    BicyclePowerSensor,
    FitnessEquipmentSensor,
} = require('incyclist-ant-plus');
const {AntDevice} = require('incyclist-ant-plus/lib/bindings');
const mqtt = require('mqtt');
const topicCache = require('memory-cache');
const antUtils = require('./antUtils');
const mqttAuth = require('./auth.json');

// MQTT connection details
const MQTT_SERVER_HOST = '192.168.1.64';
const MQTT_SERVER_PORT = '1883';
const MQTT_MAIN_TOPIC = 'antplus';

// Sleep
const sleep = async () => new Promise(resolve => setTimeout(resolve, 5000));
const CACHE_TTL = 60000;

// ANT Stick
const ant = new AntDevice({startupTimeout:2000/*,debug:true, logger:console*/});

// MQTT publish utils
function getManufacturerName(manId) {
    return antUtils.manufacturerId.get(manId) || manId;
}

async function connectAnt(client) {
    // Publish MQTT messages
    const publishOptions = {
        'qos': 0,
        'retain': false,
        'properties': { 'messageExpiryInterval': 10, }
    }
    function publishData(topic, message) {
        antUtils.antTopics.forEach((value, key) => {
            let data = message[key];
            if (data) {
                if (key === 'ManId') {
                    data = getManufacturerName(data);
                }
                else {
                    data = String(data);
                }
                const newTopic = `${topic}/${value.name}`;
                // console.log(`publishData: ${newTopic}: ${message[key]}`);    
                client.publish(newTopic, data, publishOptions, (err) => {
                    if (err)
                        console.error(`publishData: Failed to publish: ${JSON.stringify(err)}`);
                    else
                        console.log(`publishData: Published ${newTopic}: ${data}`);
                });
                if (value.cache) {
                    // cache topic to be updated after ttl
                    topicCache.put(newTopic, 0, CACHE_TTL, (cacheKey, cacheValue) => {
                        client.publish(cacheKey, cacheValue, publishOptions, (err) => {
                            if (err)
                            console.error(`publishData: Failed to clean cache: ${JSON.stringify(err)}`);
                        else
                            console.log(`publishData: Cache cleaned: ${newTopic}`);    
                        });
                    });
                }
            }
        });
    }
    // Ant handlers
    function onAntData(profile, deviceId, data) {
        // console.log(`onAntData: ${profile} / ${deviceId} : ${JSON.stringify(data)}`);
        const topic = `${MQTT_MAIN_TOPIC}/${profile}/${deviceId}`;
        publishData(topic, data);
    }

    function onAntDetected(profile, deviceId) {
        // console.log(`onAntDetected: ${profile} / ${deviceId}`);
    }

    // Open ANT+ USB Stick
    let stickOpened = false;
    do {
        stickOpened = await ant.open();
		if (!stickOpened) {
			console.log('antLoop: Could not open ANT Stick');
			await sleep();
		}
		else {
			console.log('antLoop: ANT Stick opened');
		}
    }
    while (!stickOpened);

    // Open ANT+ Channel
    let channel = null;
    do {
        channel = await ant.getChannel();
        if (!channel) {
            console.log('antLoop: Could not open channel');
            await sleep();
        }
    }
    while (!channel);
    // Channel opened successfully
    console.log('antLoop: Channel opened');

    // Configure handlers
    channel.on('data', onAntData);
    channel.on('detected', onAntDetected);

    // Attach sensors
    channel.attach(new HeartRateSensor());
    channel.attach(new CadenceSensor());
    channel.attach(new SpeedSensor());
    channel.attach(new SpeedCadenceSensor());
    channel.attach(new BicyclePowerSensor());
    channel.attach(new FitnessEquipmentSensor());

    // Start scanner
    channel.startScanner();
}

async function connectMqtt() {
    // Client for the mqtt broker
    const options = {
        port: MQTT_SERVER_PORT,
        host: MQTT_SERVER_HOST,
        username: mqttAuth.mqttUser,
        password: mqttAuth.mqttPass,
        protocol: 'mqtt'
    };
    let client = null;
    do {
        client = mqtt.connect(options);
        if (!client) {
            console.log('connectMqtt: Could not connect to server');
            await sleep();
        }
    }
    while (!client);
    // Connection successful
    console.log('connectMqtt: Connected to server');

    // Configure handlers
    client.on('connect', () => {
        console.log('MQTT connected');
    });
    client.on('reconnect', () => {
        console.log('MQTT reconnected');
    });
    client.on('disconnect', () => {
        console.log('MQTT disconnected');
    });
    client.on('error', (error) => {
        console.log(`MQTT error: ${error}`);
    });
    return client;
}

// Main function
async function main(deviceId=-1) {
    console.log('Starting...');
    // Connect to the MQTT server
    const client = await connectMqtt();

    // Connect to Ant stick
    await connectAnt(client);

    // Clean up and exit
    async function onExit() {
        console.log('\nTerminating Node program');
        try {
            ant.close();
            console.log('ANT device closed');
        }
        catch (error) {
            // Do nothing...
            console.log('Failed to close ANT device');
        }
        try {
            await client.end(() => {
                console.log('MQTT client closed');
            });    
        }
        catch (error) {
            // Do nothing
            console.log('Failed to close MQTT client');
        }
    }

    process.on('SIGINT', async () => await onExit());
    process.on('SIGQUIT', async () => await onExit());
    process.on('SIGTERM', async () => await onExit());
}

const args = process.argv.slice(2);
const deviceId = args.length>0 ? args[0] : undefined;

main( deviceId );
