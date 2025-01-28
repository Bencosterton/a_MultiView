##########################################################################
#                                                                        #
#                             a_MultiView                                #
#                                                                        #
#                               by ben                                   #
#                                                                        #
##########################################################################
#                                                                        #
#                                v.2.0                                   #
#                                                                        #
##########################################################################

from flask import Flask, render_template, jsonify, request
from flask_sock import Sock

app = Flask(__name__)
sock = Sock(app)

@app.route('/')
def index():
    return render_template('multiview.html')

@app.route('/api/system_info')
def system_info():
    try:
        hostname = socket.gethostname()
        ip_addresses = []
        interfaces = socket.getaddrinfo(socket.gethostname(), None)

        unique_ips = set()
        for interface in interfaces:
            ip = interface[4][0]
            if ':' not in ip:  # Exclude IPv6
                unique_ips.add(ip)

        ip_addresses = sorted(list(unique_ips))

        return jsonify({
            'hostname': hostname,
            'ip_addresses': ip_addresses
        })
    except Exception as e:
        return jsonify({
            'hostname': "Error getting hostname",
            'ip_addresses': []
        })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5030)
