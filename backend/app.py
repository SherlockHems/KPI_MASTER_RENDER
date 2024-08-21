from flask import Flask, jsonify
from flask_cors import CORS
import kpi_master

app = Flask(__name__)
CORS(app)

@app.route('/api/dashboard')
def dashboard():
    return jsonify(kpi_master.dashboard_data)

@app.route('/api/sales')
def sales():
    return jsonify(kpi_master.sales_data)

@app.route('/api/clients')
def clients():
    return jsonify(kpi_master.clients_data)

@app.route('/api/funds')
def funds():
    return jsonify(kpi_master.funds_data)

@app.route('/api/forecast')
def forecast():
    return jsonify(kpi_master.forecast_data)

if __name__ == '__main__':
    app.run(debug=True)