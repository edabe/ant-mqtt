## ANT+ and MQTT
This is a very basic experiment!

Creates a Node.js application that listens to ANT devices (USB Stick) and send data to a MQTT broker.

References:
- [Raspberry Pi Ant+](https://infinityflow.ch/raspberry-pi-ant/) (German)
- [Track Your Heartrate on Raspberry Pi with Ant+](https://bin.re/blog/track-your-heartrate-on-raspberry-pi-with-ant/)
- [Reading from ANT+ USB Stick](https://forums.raspberrypi.com/viewtopic.php?t=26124#p310583)

Dependencies
- [MQTT.js](https://github.com/mqttjs/MQTT.js/tree/main)

#### Set-up
I'm using a Raspberry Pi 4 running Rapbian and an old Garmin USB stick.

My MQTT server is a Mosquitto broker running on a separate HomeAsistant setup.

- Connect to the Raspberry pi
- Insert the USB stick 
- Check that it is being recognized
    ```
    eabe@rpi:~ $ lsusb
    Bus 002 Device 001: ID 1d6b:0003 Linux Foundation 3.0 root hub
    Bus 001 Device 004: ID 0fcf:1008 Dynastream Innovations, Inc. ANTUSB2 Stick
    Bus 001 Device 002: ID 2109:3431 VIA Labs, Inc. Hub
    Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
    ```
- My USB stick is described as `Bus 001 Device 004: ID 0fcf:1008 Dynastream Innovations, Inc. ANTUSB2 Stick` from where we can get:
    - idVendor: `0fcf`
    - idProduct: `1008`
- Unplug the USB stick
- Create a `udev` rule to get the USB serial kernel driver to create a node for the USB stick
    ```
    eabe@rpi:~ $ sudo vi /etc/udev/rules.d/ant-usb-m.rules
    ```
- With the following content (adjust `idVendor` and `idProduct` based on your own USB stick):
    ```
    SUBSYSTEM=="usb", ATTRS{idVendor}=="0fcf", ATTRS{idProduct}=="1008", RUN+="/sbin/modprobe usbserial vendor=0x0fcf product=0x1008", MODE="0666", GROUP="users"
    ```
- Re-insert the USB stick and check that a `/dev/ttyUSB0` node was created:
    ```
    eabe@rpi:~ $ ls -la /dev/ttyUSB0 
    crw-rw---- 1 root dialout 188, 0 Nov 12 13:37 /dev/ttyUSB0
    ```
    - Note that for me the `MODE` and `GROUP` defined in the `udev` rule is ignored - the node has mode `660` and group `dialout`. Make sure your app user is member of the group.


#### Configuration

#### Running