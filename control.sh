#!/bin/bash

cd "$(dirname "$0")"

USER=exter-n
PIDFILE=nex-iv.pid
DISPLAY_NAME=Nex-IV

do_stop() {
    local WAITER_PID SERVICE_PID
    inotifywait -e DELETE_SELF -t 5 "$PIDFILE" >&/dev/null &
    WAITER_PID="$!"
    SERVICE_PID="$(cat "$PIDFILE" 2>/dev/null)"
    if [ -z "$SERVICE_PID" ]; then
        kill "$WAITER_PID"
        wait "$WAITER_PID"
        return 1
    fi
    kill "$SERVICE_PID"
    if ! wait "$WAITER_PID"; then
        kill -9 "$SERVICE_PID"
        rm -f "$PIDFILE"
    fi
}

stop() {
    if ! status > /dev/null; then
        return 0
    fi
    local RETVAL
    echo -n "Stopping $DISPLAY_NAME ..."
    if do_stop; then
        echo " OK."
        return 0
    else
        echo " Failed."
        return 1
    fi
}

do_start() {
    if [ "$(id -nu)" == "$USER" ]; then
        ./index.js
    else
        sudo -u "$USER" ./index.js
    fi
}

start() {
    if status > /dev/null; then
        return 0
    fi
    local RETVAL
    echo -n "Starting $DISPLAY_NAME ..."
    if do_start; then
        echo " OK."
        return 0
    else
        echo " Failed."
        return 1
    fi
}

status() {
    local SERVICE_PID
    SERVICE_PID="$(cat "$PIDFILE" 2>/dev/null)"
    if [ -z "$SERVICE_PID" ]; then
        echo "$DISPLAY_NAME is stopped."
        return 1
    elif kill -0 "$SERVICE_PID"; then
        echo "$DISPLAY_NAME is started, PID : $SERVICE_PID."
        return 0
    else
        echo "$DISPLAY_NAME is stopped but left its PID file behind, PID : $SERVICE_PID."
        return 2
    fi
}

case "$1" in
    start|stop|status)
        "$@"
        ;;
    restart|force-reload)
        stop
        start
        ;;
esac
