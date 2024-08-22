from flask import Flask, jsonify
from flask_cors import CORS
import kpi_master_v1_07
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)

@app.route('/')
def home():
    app.logger.info("Home route accessed")
    return "Welcome to the KPI Master API"

@app.route('/api/dashboard')
def dashboard():
    return jsonify(kpi_master_v1_07.dashboard_data)

@app.route('/api/sales')
def sales():
    return jsonify(kpi_master_v1_07.sales_data)

@app.route('/api/clients')
def clients():
    return jsonify(kpi_master_v1_07.clients_data)

@app.route('/api/funds')
def funds():
    return jsonify(kpi_master_v1_07.funds_data)

@app.route('/api/forecast')
def forecast():
    return jsonify(kpi_master_v1_07.forecast_data)

if __name__ == '__main__':
    app.run(debug=True)