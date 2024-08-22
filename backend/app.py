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
        if not daily_income or not client_sales:
            logger.error("daily_income or client_sales is empty")
            return {"error": "No sales data available"}
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
        logger.error(f"KPI import error: {kpi_import_error}")
        return {"error": f"Failed to import necessary functions: {kpi_import_error}"}

    start_date = datetime.date(2023, 12, 31)
    end_date = datetime.date(2024, 6, 30)

    try:
        logger.info("Starting data loading and processing")

        initial_holdings = load_initial_holdings('data/2023DEC.csv')
        logger.info(f"Initial holdings loaded: {len(initial_holdings)} clients")

        trades = load_trades('data/TRADES_LOG.csv')
        logger.info(f"Trades loaded: {len(trades)} clients")

        product_info = load_product_info('data/PRODUCT_INFO.csv')
        logger.info(f"Product info loaded: {len(product_info)} products")

        client_sales = load_client_sales('data/CLIENT_LIST.csv')
        logger.info(f"Client sales info loaded: {len(client_sales)} clients")

        daily_holdings = calculate_daily_holdings(initial_holdings, trades, start_date, end_date)
        logger.info(f"Daily holdings calculated: {len(daily_holdings)} clients")

        daily_income, sales_income, client_income = calculate_daily_income(daily_holdings, product_info, client_sales)
        logger.info(f"Daily income calculated: {len(daily_income)} days")

        if not sales_income:
            logger.error("sales_income is empty")
            return {"error": "No sales data available"}

        logger.info("Data loading and processing completed successfully")
        return {
            'daily_income': daily_income,
            'sales_income': sales_income,
            'client_income': client_income,
            'client_sales': client_sales,
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


# In app.py, update the /api/sales route

@app.route('/api/sales')
def sales():
    try:
        logger.info("Sales route accessed")

        if not data or 'sales_income' not in data:
            logger.error("No sales data available")
            return jsonify({"error": "No sales data available"}), 404

        # Calculate total clients for each sales person
        sales_person_clients = {}
        for client, sales_person in data['client_sales'].items():
            if sales_person not in sales_person_clients:
                sales_person_clients[sales_person] = set()
            sales_person_clients[sales_person].add(client)

        # Prepare the sales data including client and fund breakdowns
        sales_data = {
            'salesPersons': [],
            'dailyContribution': [],
            'individualPerformance': {}
        }

        for date, daily_income in data['sales_income'].items():
            daily_data = {'date': date.isoformat()}
            for sales_person, income in daily_income.items():
                daily_data[sales_person] = income

                if sales_person not in sales_data['individualPerformance']:
                    sales_data['individualPerformance'][sales_person] = {
                        'dailyIncome': [],
                        'clientBreakdown': {},
                        'fundBreakdown': {}
                    }

                sales_data['individualPerformance'][sales_person]['dailyIncome'].append({
                    'date': date.isoformat(),
                    'income': income
                })

                # Calculate client and fund breakdowns
                for client, client_income in data['client_income'][date].items():
                    if data['client_sales'].get(client) == sales_person:
                        sales_data['individualPerformance'][sales_person]['clientBreakdown'][client] = \
                        sales_data['individualPerformance'][sales_person]['clientBreakdown'].get(client,
                                                                                                 0) + client_income

                        for fund, fund_income in data['daily_income'][date][client].items():
                            sales_data['individualPerformance'][sales_person]['fundBreakdown'][fund] = \
                            sales_data['individualPerformance'][sales_person]['fundBreakdown'].get(fund,
                                                                                                   0) + fund_income

            sales_data['dailyContribution'].append(daily_data)

        # Calculate total income and prepare sales person data
        for sales_person, daily_incomes in sales_data['individualPerformance'].items():
            total_income = sum(day['income'] for day in daily_incomes['dailyIncome'])
            sales_data['salesPersons'].append({
                'name': sales_person,
                'totalIncome': total_income,
                'totalClients': len(sales_person_clients.get(sales_person, set()))
            })

        # Sort client and fund breakdowns and get top 10
        for sales_person in sales_data['individualPerformance']:
            sales_data['individualPerformance'][sales_person]['topClients'] = sorted(
                sales_data['individualPerformance'][sales_person]['clientBreakdown'].items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]

            sales_data['individualPerformance'][sales_person]['topFunds'] = sorted(
                sales_data['individualPerformance'][sales_person]['fundBreakdown'].items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]

        return jsonify(sales_data)
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