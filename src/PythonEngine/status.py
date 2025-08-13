import json
from random import random

response = {
    "status": 200,
    "message": "",
    "python_logs": []
}

python_logs = []

# Replacement for print() since print() returns a string without ending the script
def console_log(message):
    python_logs.append(message)

# Replacement for return, plus a status code. Prints the JSON response object.
def send(message, status=200):
    response["status"] = status  # Status of this script; not necessarily API response code
    response["message"] = message  # Plain text response that this script returns
    response["python_logs"] = python_logs  # List of strings for Express server to log to console
    # Any additional fields may be added in other parts of the script, i.e. `response["shipsHit"] = [0, 4, 7, 9]`
    print(json.dumps(response), end="")  # Express reads this and parses the JSON
    exit(0)  # Makes send() act as a `return`, making the script stop once the response is sent

try:
    # Put python script code here.
    # Replace print() with console_log() and return a string value with send()

    console_log("test log")
    console_log("Testing 123")
    if random() > 0.5:
        response["Under"] = "tale"
    else:
        response["Under"] = "da water"
    send("Hello World!")  # send() is basically a return. Everything below here is unreachable.
    console_log("This shouldn't print.")
    raise Exception("Test Exception. This shouldn't be reachable.")
    send("this shouldn't print either.")
except Exception as e:
    response["error"] = str(e)
    send("An unexpected error occurred", 500)
