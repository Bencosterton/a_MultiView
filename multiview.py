##########################################################################
#                                                                        #
#                             a_MultiView                                #
#                                                                        #
#                               by ben                                   #
#                                                                        #
##########################################################################
#                                                                        #
#                                v.2.1                                   #
#                                                                        #
##########################################################################
import os
from flask import Flask, render_template, jsonify, request, send_file
from flask_sock import Sock
import csv
import socket

app = Flask(__name__)
sock = Sock(app)

PRESETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'presets')
os.makedirs(PRESETS_DIR, exist_ok=True)

@app.route('/')
@app.route('/<preset_name>')
def index(preset_name=None):
    return render_template('multiview.html', preset_name=preset_name)

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

@app.route('/api/presets')
def list_presets():
    """List available preset configurations"""
    presets = []
    for filename in os.listdir(PRESETS_DIR):
        if filename.endswith('.csv'):
            preset_name = os.path.splitext(filename)[0]
            presets.append(preset_name)
    return jsonify({'presets': presets})

@app.route('/api/preset/<preset_name>')
def get_preset(preset_name):
    """Get a specific preset configuration"""
    try:
        preset_path = os.path.join(PRESETS_DIR, f'{preset_name}.csv')
        if not os.path.exists(preset_path):
            return jsonify({'error': 'Preset not found'}), 404
            
        # Read CSV file
        streams = []
        with open(preset_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                streams.append({
                    'name': row.get('Name', ''),
                    'url': row.get('Stream URL', '')
                })
                
        return jsonify({'streams': streams})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/preset/<preset_name>', methods=['POST'])
def save_preset(preset_name):
    """Save a preset configuration"""
    try:
        data = request.json
        if not data or 'streams' not in data:
            return jsonify({'error': 'Invalid data'}), 400
            
        preset_path = os.path.join(PRESETS_DIR, f'{preset_name}.csv')
        
        # Write CSV file
        with open(preset_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['Name', 'Stream URL'])
            writer.writeheader()
            for stream in data['streams']:
                writer.writerow({
                    'Name': stream.get('name', ''),
                    'Stream URL': stream.get('url', '')
                })
                
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5030)
