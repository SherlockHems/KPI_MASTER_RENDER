from flask import Flask, jsonify
from flask_cors import CORS
import logging
import datetime
import pandas as pd
import os
import pprint
import json
import traceback

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Import functions from kpi_master_v1_07
try:
    from kpi_master_v1_07 import (
        load_initial_holdings,
        load_trades,
        load_product_info,
        load_client_sales,
        calculate_daily_holdings,
        calculate_daily_income,
        calculate_cumulative_income,
        show_income_statistics,
        generate_forecasts,
        generate_sales_person_breakdowns,
        generate_client_breakdowns
    )

    kpi_import_error = None
except ImportError as e:
    kpi_import_error = str(e)
    logger.error(f"Error importing from kpi_master_v1_07: {e}")


def prepare_sales_data(daily_income, client_sales):
    logger.info("Preparing sales data")
    try:
        sales_person_income = {}
        for date, clients in daily_income.items():
            for client, funds in clients.items():
                sales_person = client_sales.get(client, "Unknown")
                if sales_person not in sales_person_income:
                    sales_person_income[sales_person] = {}
                if date not in sales_person_income[sales_person]:
                    sales_person_income[sales_person][date] = 0
                sales_person_income[sales_person][date] += sum(funds.values())

        sales_data = {
            'salesPersons': [],
            'dailyContribution': [],
            'individualPerformance': {}
        }

        all_dates = sorted(set(date for sp_data in sales_person_income.values() for date in sp_data.keys()))

        for date in all_dates:
            daily_data = {'date': date.isoformat()}
            for sales_person, income_data in sales_person_income.items():
                daily_data[sales_person] = income_data.get(date, 0)
            sales_data['dailyContribution'].append(daily_data)

        for sales_person, income_data in sales_person_income.items():
            cumulative_income = sum(income_data.values())
            sales_data['individualPerformance'][sales_person] = [
                {'date': date.isoformat(), 'income': income}
                for date, income in sorted(income_data.items())
            ]

            sales_data['salesPersons'].append({
                'name': sales_person,
                'cumulativeIncome': cumulative_income
            })

        logger.info("Sales data prepared successfully")
        return sales_data
    except Exception as e:
        logger.error(f"Error preparing sales data: {str(e)}")
        logger.error(traceback.format_exc())
        return {"error": "Failed to prepare sales data"}


def check_file_exists(filepath):
    if os.path.exists(filepath):
        logger.info(f"File exists: {filepath}")
    else:
        logger.error(f"File does not exist: {filepath}")


def check_data_integrity():
    logger.info("Checking data integrity")
    if 'daily_income' not in data:
        logger.error("daily_income is missing from data")
        return False
    if 'client_sales' not in data:
        logger.error("client_sales is missing from data")
        return False
    logger.info("Data integrity check passed")
    return True


def load_and_process_data():
    if kpi_import_error:
        return {"error": f"Failed to import necessary functions: {kpi_import_error}"}

    start_date = datetime.date(2023, 12, 31)
    end_date = datetime.date(2024, 6, 30)

    try:
        check_file_exists('data/2023DEC.csv')
        check_file_exists('data/TRADES_LOG.csv')
        check_file_exists('data/PRODUCT_INFO.csv')
        check_file_exists('data/CLIENT_LIST.csv')

        initial_holdings = load_initial_holdings('data/2023DEC.csv')
        trades = load_trades('data/TRADES_LOG.csv')
        product_info = load_product_info('data/PRODUCT_INFO.csv')
        client_sales = load_client_sales('data/CLIENT_LIST.csv')

        daily_holdings = calculate_daily_holdings(initial_holdings, trades, start_date, end_date)
        daily_income, sales_income, client_income = calculate_daily_income(daily_holdings, product_info, client_sales)

        cumulative_sales_income = calculate_cumulative_income(sales_income)
        cumulative_client_income = calculate_cumulative_income(client_income)

        client_stats, fund_stats, sales_stats = show_income_statistics(daily_income, sales_income, client_income,
                                                                       daily_holdings, product_info)

        forecasts = generate_forecasts(daily_income, product_info, daily_holdings, trades, end_date)

        sales_person_breakdowns = generate_sales_person_breakdowns(daily_income, client_sales)
        client_breakdowns = generate_client_breakdowns(daily_income)

        return {
            'daily_income': daily_income,
            'sales_income': sales_income,
            'client_income': client_income,
            'client_sales': client_sales,
            'cumulative_sales_income': cumulative_sales_income,
            'cumulative_client_income': cumulative_client_income,
            'client_stats': client_stats,
            'fund_stats': fund_stats,
            'sales_stats': sales_stats,
            'forecasts': forecasts,
            'daily_holdings': daily_holdings,
            'sales_person_breakdowns': sales_person_breakdowns,
            'client_breakdowns': client_breakdowns
        }
    except Exception as e:
        logger.error(f"Error in load_and_process_data: {e}")
        logger.error(traceback.format_exc())
        return {"error": str(e)}


# Load and process data
data = load_and_process_data()

# Prepare sales data if no error occurred
if 'error' not in data:
    sales_data = prepare_sales_data(data['daily_income'], data['client_sales'])
else:
    sales_data = {"error": data['error']}


@app.route('/')
def home():
    logger.info("Home route accessed")
    return "Welcome to the KPI Master API"


@app.route('/api/debug')
def debug():
    return jsonify({
        'daily_income_structure': str(type(data['daily_income'])),
        'daily_income_sample': str(dict(list(data['daily_income'].items())[:1])),
        'client_sales_structure': str(type(data['client_sales'])),
        'client_sales_sample': str(dict(list(data['client_sales'].items())[:5]))
    })


@app.route('/api/dashboard')
def dashboard():
    if 'error' in data:
        return jsonify({"error": data['error']})

    try:
        total_income = 0
        for date, clients in data['daily_income'].items():
            for client, funds in clients.items():
                for fund, income in funds.items():
                    if isinstance(income, (int, float)):
                        total_income += income
                    else:
                        logger.warning(
                            f"Non-numeric income value: {income} for date {date}, client {client}, fund {fund}")

        total_clients = len(set(client for day in data['daily_income'].values() for client in day.keys()))
        total_funds = len(set(fund for day in data['daily_income'].values()
                              for client in day.values()
                              for fund in client.keys()))
        total_sales = len(set(data['client_sales'].values()))

        income_trend = [{'date': date,
                         'income': sum(sum(fund.values()) for fund in clients.values())}
                        for date, clients in data['daily_income'].items()]

        return jsonify({
            'total_income': total_income,
            'total_clients': total_clients,
            'total_funds': total_funds,
            'total_sales': total_sales,
            'income_trend': income_trend
        })
    except Exception as e:
        logger.error(f"Error in dashboard route: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"An error occurred while processing dashboard data: {str(e)}"}), 500


@app.route('/api/sales')
def sales():
    try:
        logger.info("Sales route accessed")
        if not check_data_integrity():
            return jsonify({"error": "Data integrity check failed"}), 500

        logger.debug(f"sales_data: {json.dumps(sales_data, default=str)}")

        result = jsonify(sales_data)
        logger.info("Sales data successfully jsonified")
        return result
    except Exception as e:
        logger.error(f"Error in sales route: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.route('/api/clients')
def clients():
    if 'error' in data:
        return jsonify({"error": data['error']})

    return jsonify({
        'client_income': {date.isoformat(): {client: sum(funds.values()) for client, funds in clients.items()}
                          for date, clients in data['daily_income'].items()},
        'client_stats': data['client_stats'].to_dict()
    })


@app.route('/api/funds')
def funds():
    if 'error' in data:
        return jsonify({"error": data['error']})

    fund_income = {}
    for date, clients in data['daily_income'].items():
        fund_income[date.isoformat()] = {}
        for client, funds in clients.items():
            for fund, income in funds.items():
                if fund not in fund_income[date.isoformat()]:
                    fund_income[date.isoformat()][fund] = 0
                fund_income[date.isoformat()][fund] += income

    return jsonify({
        'fund_income': fund_income,
        'fund_stats': data['fund_stats'].to_dict()
    })


@app.route('/api/forecast')
def forecast():
    if 'error' in data:
        return jsonify({"error": data['error']})
    return jsonify(data['forecasts'])


@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {str(e)}")
    logger.error(traceback.format_exc())
    return jsonify({"error": "An unexpected error occurred"}), 500


if __name__ == '__main__':
    app.run(debug=True)