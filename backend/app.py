from flask import Flask, jsonify
from flask_cors import CORS
import logging
import datetime
import pandas as pd
import traceback
from kpi_master_v1_07 import (
    load_initial_holdings, load_trades, load_product_info, load_client_sales,
    calculate_daily_holdings, calculate_daily_income, calculate_cumulative_income,
    show_income_statistics, generate_forecasts, generate_sales_person_breakdowns,
    generate_client_breakdowns
)

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load data
start_date = datetime.date(2023, 12, 31)
end_date = datetime.date(2024, 6, 30)
initial_holdings = load_initial_holdings('data/2023DEC.csv')
trades = load_trades('data/TRADES_LOG.csv')
product_info = load_product_info('data/PRODUCT_INFO.csv')
client_sales = load_client_sales('data/CLIENT_LIST.csv')

# Calculate data
daily_holdings = calculate_daily_holdings(initial_holdings, trades, start_date, end_date)
daily_income, sales_income, client_income = calculate_daily_income(daily_holdings, product_info, client_sales)
cumulative_sales_income = calculate_cumulative_income(sales_income)
cumulative_client_income = calculate_cumulative_income(client_income)
client_stats, fund_stats, sales_stats = show_income_statistics(daily_income, sales_income, client_income, daily_holdings, product_info)
forecasts = generate_forecasts(daily_income, product_info, daily_holdings, trades, end_date)
sales_person_breakdowns = generate_sales_person_breakdowns(daily_income, client_sales)
client_breakdowns = generate_client_breakdowns(daily_income)

@app.route('/api/dashboard')
def get_dashboard():
    try:
        logger.info("Processing dashboard data")
        total_income = sum(sum(client.values()) for client in daily_income[max(daily_income.keys())].values())
        total_clients = len(set(client for day in daily_income.values() for client in day.keys()))
        total_funds = len(set(fund for day in daily_income.values() for client in day.values() for fund in client.keys()))
        total_sales = len(set(sales_income[max(sales_income.keys())].keys()))

        income_trend = [{'date': date.isoformat(), 'income': sum(sum(client.values()) for client in clients.values())}
                        for date, clients in daily_income.items()]

        dashboard_data = {
            'total_income': total_income,
            'total_clients': total_clients,
            'total_funds': total_funds,
            'total_sales': total_sales,
            'income_trend': income_trend
        }

        logger.info("Dashboard data processed successfully")
        return jsonify(dashboard_data)
    except Exception as e:
        logger.error(f"Error processing dashboard data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'An error occurred while processing dashboard data'}), 500

@app.route('/api/sales')
def get_sales():
    try:
        logger.info("Processing sales data")
        sales_data = {
            'salesPersons': [],
            'dailyContribution': [],
            'individualPerformance': {}
        }

        # Prepare daily contribution data
        for date in sales_income.keys():
            daily_data = {'date': date.isoformat()}
            for sales_person in sales_income[date].keys():
                daily_data[sales_person] = sales_income[date][sales_person]
            sales_data['dailyContribution'].append(daily_data)

        # Prepare individual performance and sales persons data
        for sales_person in set(person for daily in sales_income.values() for person in daily.keys()):
            sales_data['individualPerformance'][sales_person] = []
            cumulative_income = 0
            all_clients = set()
            all_funds = set()

            for date in sorted(sales_income.keys()):
                if sales_person in sales_income[date]:
                    cumulative_income += sales_income[date][sales_person]

                    # Get actual client and fund data
                    client_data = sales_person_breakdowns[date][sales_person]['clients']
                    fund_data = sales_person_breakdowns[date][sales_person]['funds']

                    all_clients.update(client_data.keys())
                    all_funds.update(fund_data.keys())

                    sales_data['individualPerformance'][sales_person].append({
                        'date': date.isoformat(),
                        'income': cumulative_income,
                        'clients': client_data,
                        'funds': fund_data
                    })

            sales_data['salesPersons'].append({
                'name': sales_person,
                'cumulativeIncome': cumulative_income,
                'totalClients': len(all_clients),
                'totalFunds': len(all_funds),
                'topClients': sorted(all_clients)[:10],  # Just for reference, not used for counting
                'topFunds': sorted(all_funds)[:10]  # Just for reference, not used for counting
            })

        logger.info("Sales data processed successfully")
        return jsonify(sales_data)
    except Exception as e:
        logger.error(f"Error processing sales data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'An error occurred while processing sales data'}), 500

@app.route('/api/clients')
def get_clients():
    try:
        logger.info("Processing clients data")
        clients_data = []

        for client, sales_person in client_sales.items():
            logger.debug(f"Processing client: {client}, Sales Person: {sales_person}")
            client_value = sum(sum(daily_income[date].get(client, {}).values()) for date in daily_income)
            logger.debug(f"Client value: {client_value}")

            found = False
            for sales_data in clients_data:
                if sales_data["name"] == sales_person:
                    sales_data["clients"].append({
                        "name": client,
                        "value": client_value
                    })
                    sales_data["clientCount"] += 1
                    sales_data["totalClientValue"] += client_value
                    found = True
                    break

            if not found:
                clients_data.append({
                    "name": sales_person,
                    "clientCount": 1,
                    "totalClientValue": client_value,
                    "clients": [{
                        "name": client,
                        "value": client_value
                    }]
                })

        logger.info(f"Processed data for {len(clients_data)} sales persons")
        logger.debug(f"Clients data: {clients_data}")

        return jsonify(clients_data)
    except Exception as e:
        logger.error(f"Error processing clients data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'An error occurred while processing clients data'}), 500

if __name__ == '__main__':
    app.run(debug=True)