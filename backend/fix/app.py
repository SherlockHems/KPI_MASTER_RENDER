from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import logging
import json
import os
from urllib.parse import unquote
from dotenv import load_dotenv
from vector_db import get_vectordb
import requests
import traceback
from kpi_master_v1_07 import (
    load_initial_holdings, load_trades, load_product_info, load_client_sales,
    calculate_daily_holdings, calculate_daily_income, calculate_cumulative_income,
    show_income_statistics, generate_forecasts, generate_sales_person_breakdowns,
    generate_client_breakdowns, calculate_fund_income, calculate_all_funds_client_breakdown
)
from datetime import date, datetime, timedelta
import datetime as dt
import sqlite3
import threading
import time
from datetime import datetime

# 修改 docx 导入
try:
    from docx import Document
except ImportError:
    from docx.api import Document

# 加载 .env 文件
load_dotenv()

# 获取 API 密钥
openai_api_key = os.getenv("OPENAI_API_KEY")
fastgpt_api_key = os.getenv("FASTGPT_API_KEY")

# 设置 OpenAI API 密钥（用于向量数据库）
os.environ["OPENAI_API_KEY"] = openai_api_key

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})  # 这确保允许跨域请求

# 设置日志
logging.basicConfig(level=logging.DEBUG)

# 获取当前脚本的目录
current_dir = os.path.dirname(os.path.abspath(__file__))

# 构建数据文件的完整路径
data_path = os.path.join(current_dir, '..', 'data', 'combined_product_data.csv')
nav_data_path = os.path.join(current_dir, '..', 'data', '产品净值矩阵_VALUE.csv')
company_info_path = os.path.join(current_dir, '..', 'data', 'company_info.json')
financial_data_path = os.path.join(current_dir, '..', 'data', 'financial_data.json')
regulations_path = os.path.join(current_dir, '..', 'data', 'regulations.json')
personnel_path = os.path.join(current_dir, '..', 'data', 'personnel.json')
product_elements_path = os.path.join(current_dir, '..', 'data', '产品要素表_存续.xlsx')
stats_file_path = os.path.join(current_dir, '..', 'data', '产品要素表_要素统计.xlsx')
performance_data_path = os.path.join(current_dir, '..', 'data', '民生通惠产品表现.csv')

# 读取数据
df = pd.read_csv(data_path)
logging.info(f"Loaded data with shape: {df.shape}")
logging.info(f"Columns: {df.columns.tolist()}")

# 读取产品净值数据
nav_data = pd.read_csv(nav_data_path, index_col=0, parse_dates=True)
logging.info(f"Loaded nav data with shape: {nav_data.shape}")
logging.info(f"Nav data columns: {nav_data.columns.tolist()}")
logging.info(f"Nav data index: {nav_data.index}")

# 读取产品要素表
product_elements_df = pd.read_excel(product_elements_path)
print("Excel文件列名:", product_elements_df.columns.tolist())
print("\n前5行数据:\n", product_elements_df.head().to_string())
print("\n数据类型:\n", product_elements_df.dtypes)
print("\n非空值计数:\n", product_elements_df.count())
print("\n唯一值:\n", product_elements_df.nunique())

# 获取列名序
column_order = product_elements_df.columns.tolist()

# 加载向量数据库
vectordb = get_vectordb()

def read_company_info():
    if os.path.exists(company_info_path):
        with open(company_info_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            return data if isinstance(data, list) else []
    return []

def write_company_info(data):
    with open(company_info_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)

def read_financial_data():
    if os.path.exists(financial_data_path):
        with open(financial_data_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            return data if isinstance(data, list) else []
    return []

def write_financial_data(data):
    with open(financial_data_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)

def read_regulations():
    if os.path.exists(regulations_path):
        with open(regulations_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            return data if isinstance(data, list) else []
    return []

def write_regulations(data):
    with open(regulations_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)

def read_personnel():
    if os.path.exists(personnel_path):
        with open(personnel_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            return data if isinstance(data, list) else []
    return []

def write_personnel(data):
    with open(personnel_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)

@app.route('/api/company-info', methods=['GET', 'POST', 'DELETE'])
def company_info():
    if request.method == 'GET':
        logging.info("获取公司信息")
        company_info = read_company_info()
        return jsonify(company_info)
    elif request.method == 'POST':
        logging.info("更新公司信息")
        new_info = request.json
        if isinstance(new_info, list):
            write_company_info(new_info)
            return jsonify({"message": "司信息已更新"}), 200
        else:
            return jsonify({"error": "无效的数据格式"}), 400
    elif request.method == 'DELETE':
        logging.info("删除公司信息模块")
        index = request.args.get('index', type=int)
        company_info = read_company_info()
        if 0 <= index < len(company_info):
            del company_info[index]
            write_company_info(company_info)
            return jsonify({"message": "模块已删除"}), 200
        else:
            return jsonify({"error": "无效的索引"}), 400

@app.route('/api/products', methods=['GET'])
def get_products():
    logging.info("获取产品列表")
    products = df['标准产品名称'].dropna().unique().tolist()
    logging.info(f"找到 {len(products)} 个产品")
    return jsonify(products)

@app.route('/api/product/<product_name>', methods=['GET'])
def get_product_info(product_name):
    logging.info(f"获取产品信息：{product_name}")
    product_info = df[df['标准产品名称'] == product_name].fillna('无数据').to_dict('records')
    if product_info:
        info = product_info[0]
        logging.info(f"原产品信息：{json.dumps(info, ensure_ascii=False)}")
        
        # 使用 DataFrame 的列名作为字段列表
        fields = df.columns.tolist()
        
        # 创建一个新的字典,只包含存在的字段
        filtered_info = {field: info.get(field, '无数据') for field in fields}
        
        # 添加调试信息
        non_empty_fields = {k: v for k, v in filtered_info.items() if v != '无数据'}
        empty_fields = {k: v for k, v in filtered_info.items() if v == '无数据'}
        
        logging.info(f"非空字段数: {len(non_empty_fields)}")
        logging.info(f"空字段数: {len(empty_fields)}")
        logging.info(f"非空字段: {json.dumps(non_empty_fields, ensure_ascii=False)}")
        logging.info(f"空字段: {json.dumps(list(empty_fields.keys()), ensure_ascii=False)}")
        
        logging.info(f"过滤后的产品信息：{json.dumps(filtered_info, ensure_ascii=False)}")
        
        response_data = {
            "product_info": filtered_info,
            "debug_info": {
                "non_empty_field_count": len(non_empty_fields),
                "empty_field_count": len(empty_fields),
                "non_empty_fields": non_empty_fields,
                "empty_fields": list(empty_fields.keys())
            }
        }
        logging.info(f"返回的响应数据：{json.dumps(response_data, ensure_ascii=False)}")
        
        return jsonify(response_data)
    else:
        logging.warning(f"未找到产品息：{product_name}")
        return jsonify({"error": "未找到产品信息"}), 404

@app.route('/api/nav_products', methods=['GET'])
def get_nav_products():
    logging.info("获取净值产品列表")
    products = nav_data.columns.tolist()
    logging.info(f"找到 {len(products)} 个净值产品")
    return jsonify(products)

@app.route('/api/product_nav/<product_name>', methods=['GET'])
def get_product_nav(product_name):
    decoded_product_name = unquote(product_name)
    logging.info(f"Requesting nav data for product: {decoded_product_name}")
    
    if decoded_product_name not in nav_data.columns:
        logging.warning(f"Product {decoded_product_name} not found in nav data")
        return jsonify({"error": "产品不存在", "available_products": nav_data.columns.tolist()}), 404
    
    product_nav = nav_data[decoded_product_name]
    nav_list = []
    for date, nav in product_nav.items():
        try:
            nav_value = float(nav)
            if nav_value > 0:  # 只添加大于0的值
                nav_list.append({"date": date.strftime('%Y/%m/%d'), "nav": nav_value})
        except ValueError:
            logging.warning(f"Invalid nav value for {decoded_product_name} on {date}: {nav}")
            continue
    
    # 按日期排序
    nav_list.sort(key=lambda x: x['date'])
    
    logging.info(f"Returning {len(nav_list)} nav data points for {decoded_product_name}")
    logging.info(f"First data point: {nav_list[0] if nav_list else 'No data'}")
    logging.info(f"Last data point: {nav_list[-1] if nav_list else 'No data'}")
    
    return jsonify(nav_list)

@app.route('/api/ai_assistant', methods=['POST'])
def ai_assistant():
    data = request.json
    query = data['query']
    
    # 使用向量数据库检索相档
    vectordb = get_vectordb()
    retriever = vectordb.as_retriever(search_kwargs={"k": 5})  # 检索前5个最相关的文档
    docs = retriever.get_relevant_documents(query)
    
    # 提取文档内容和元数据
    context = "\n\n".join([doc.page_content for doc in docs])
    
    # 准备 FastGPT API 请求
    url = "https://api.fastgpt.in/api/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {fastgpt_api_key}"
    }
    payload = {
        "chatId": None,  # 不使用 FastGPT 的上下文功能
        "stream": False,
        "detail": False,
        "variables": {},
        "messages": [
            {
                "role": "system",
                "content": "你是一家资管公司的查询助手。你的务是根据提供的上下文信息回答用户关于金融产品的各类问题。请确保你的回答准确、专业,并且基于提供的数据。如果你不确定或者上下文中没有相关信息,请诚实地告诉用户你无法回答该问题。在回答时,请使用礼貌、专业的语气,并尽可能提供详细的解释。"
            },
            {
                "role": "user",
                "content": f"上下文信息：{context}\n\n用户问题：{query}"
            }
        ]
    }
    
    try:
        # 发送请求到 FastGPT API
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        logging.info(f"FastGPT API Response Status Code: {response.status_code}")
        logging.info(f"FastGPT API Response Headers: {response.headers}")
        logging.info(f"FastGPT API Response Content: {response.text[:500]}...")  # 只记录前500个字符
        
        response.raise_for_status()  # 如果响应状态码不是 200，将引发异常
        
        result = response.json()
        
        # 提取 AI 回答
        ai_answer = result['choices'][0]['message']['content']
    except requests.exceptions.RequestException as e:
        logging.error(f"Error calling FastGPT API: {str(e)}")
        ai_answer = "抱歉，在处理您的请求时出现了错误。请稍后再试。"
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        logging.error(f"Error parsing FastGPT API response: {str(e)}")
        ai_answer = "抱歉，在解析 AI 回答时出现了错误请稍后再试。"
    
    # 提取源文档信息和相似度得分
    sources = []
    for i, doc in enumerate(docs):
        sources.append({
            "content": doc.page_content,
            "metadata": doc.metadata,
            "similarity_score": doc.metadata.get('score', 'N/A'),  # 如果有相似度得分的话
            "rank": i + 1
        })
    
    debug_info = {
        "answer": ai_answer,
        "sources": sources,
        "query": query,
        "context_used": context,
        "model_used": "FastGPT",
        "api_response": result if 'result' in locals() else "No response"
    }
    
    # 添加日志以确保数据被正确返回
    logging.info(f"AI Assistant response: {json.dumps(debug_info, ensure_ascii=False)}")

    return jsonify(debug_info)

def read_docx(file_path):
    doc = Document(file_path)
    sections = {}
    current_section = None
    current_content = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            if text.startswith(('1、', '2、', '3、', '4', '5、')):
                if current_section:
                    sections[current_section] = '\n'.join(current_content)
                current_section = text
                current_content = []
            else:
                current_content.append(text)

    if current_section:
        sections[current_section] = '\n'.join(current_content)

    return sections

@app.route('/')
def home():
    return "Hello, World!"

@app.route('/api/financial-data', methods=['GET', 'POST', 'DELETE'])
def financial_data():
    if request.method == 'GET':
        logging.info("获取财务数据")
        financial_data = read_financial_data()
        return jsonify(financial_data)
    elif request.method == 'POST':
        logging.info("更新财务数据")
        new_info = request.json
        if isinstance(new_info, list):
            write_financial_data(new_info)
            return jsonify({"message": "财务数据已更新"}), 200
        else:
            return jsonify({"error": "无效的数据格式"}), 400
    elif request.method == 'DELETE':
        logging.info("删除财务数据模块")
        index = request.args.get('index', type=int)
        financial_data = read_financial_data()
        if 0 <= index < len(financial_data):
            del financial_data[index]
            write_financial_data(financial_data)
            return jsonify({"message": "模块已删除"}), 200
        else:
            return jsonify({"error": "无效的索引"}), 400

@app.route('/api/regulations', methods=['GET', 'POST', 'DELETE'])
def regulations():
    if request.method == 'GET':
        logging.info("获取章程制度")
        regulations_data = read_regulations()
        return jsonify(regulations_data)
    elif request.method == 'POST':
        logging.info("更新章程制度")
        new_info = request.json
        if isinstance(new_info, list):
            write_regulations(new_info)
            return jsonify({"message": "章程制度已更新"}), 200
        else:
            return jsonify({"error": "无效的数据格式"}), 400
    elif request.method == 'DELETE':
        logging.info("删除章程制度模块")
        index = request.args.get('index', type=int)
        regulations_data = read_regulations()
        if 0 <= index < len(regulations_data):
            del regulations_data[index]
            write_regulations(regulations_data)
            return jsonify({"message": "模块已删除"}), 200
        else:
            return jsonify({"error": "无效的索引"}), 400

@app.route('/api/personnel', methods=['GET', 'POST', 'DELETE'])
def personnel():
    if request.method == 'GET':
        logging.info("获取人员架构")
        personnel_data = read_personnel()
        return jsonify(personnel_data)
    elif request.method == 'POST':
        logging.info("更新人员架构")
        new_info = request.json
        if isinstance(new_info, list):
            write_personnel(new_info)
            return jsonify({"message": "人员架构已更新"}), 200
        else:
            return jsonify({"error": "无效的数据格式"}), 400
    elif request.method == 'DELETE':
        logging.info("删除人员架构模块")
        index = request.args.get('index', type=int)
        personnel_data = read_personnel()
        if 0 <= index < len(personnel_data):
            del personnel_data[index]
            write_personnel(personnel_data)
            return jsonify({"message": "模块已删除"}), 200
        else:
            return jsonify({"error": "无效的索引"}), 400

@app.route('/api/product-elements', methods=['GET'])
def get_product_elements():
    products = product_elements_df['产品简称'].dropna().unique().tolist()
    return jsonify(products)

@app.route('/api/product-elements/<product_name>', methods=['GET', 'POST'])
def product_details(product_name):
    if request.method == 'GET':
        product_info = product_elements_df[product_elements_df['产品简称'] == product_name].to_dict('records')
        if product_info:
            # 使用列顺序创建有序字典，留所有列（包括空值）
            ordered_info = [(col, str(product_info[0].get(col, ''))) for col in column_order]
            return jsonify(ordered_info)
        else:
            return jsonify({"error": "Product not found"}), 404
    elif request.method == 'POST':
        new_data = request.json
        product_index = product_elements_df.index[product_elements_df['产品简称'] == product_name].tolist()
        if product_index:
            for key, value in new_data.items():
                if key in product_elements_df.columns:
                    product_elements_df.at[product_index[0], key] = value
            product_elements_df.to_excel(product_elements_path, index=False)
            return jsonify({"message": "Product information updated successfully"}), 200
        else:
            return jsonify({"error": "Product not found"}), 404

@app.route('/api/product-dashboard', methods=['GET'])
def get_product_dashboard():
    try:
        logging.info("Starting to process dashboard data")
        
        # 确保 stats_file_path 已经定义
        logging.info(f"Reading file from: {stats_file_path}")
        stats_df = pd.read_excel(stats_file_path)
        
        logging.info(f"File read successfully. Shape: {stats_df.shape}")
        logging.info(f"Columns: {stats_df.columns.tolist()}")

        # 处理申购起点（首次）数据
        first_purchase_stats = stats_df['申购起点（首次）（万元）'].astype(str).value_counts().to_dict()
        logging.info(f"First purchase stats: {first_purchase_stats}")

        # 处理申购起点（追加）数据
        additional_purchase_stats = stats_df['申购起点（追加）（万元）'].astype(str).value_counts().to_dict()
        logging.info(f"Additional purchase stats: {additional_purchase_stats}")

        # 处理赎回起点数据
        redemption_stats = stats_df['赎回起点（万份）'].astype(str).value_counts().to_dict()
        logging.info(f"Redemption stats: {redemption_stats}")

        # 处理最低持有额数据
        min_holding_stats = stats_df['最低持有额（万份）'].astype(str).value_counts().to_dict()
        logging.info(f"Min holding stats: {min_holding_stats}")

        # 处理产品风险等级数据
        risk_level_stats = stats_df['产品风险等级'].astype(str).value_counts().to_dict()
        logging.info(f"Risk level stats: {risk_level_stats}")

        # 处理固定管理费率数据
        management_fee_stats = stats_df['固定\n管理费率'].astype(str).value_counts().to_dict()
        logging.info(f"Management fee stats: {management_fee_stats}")

        # 处理托管费率数据
        custodian_fee_stats = stats_df['托管费率'].astype(str).value_counts().to_dict()
        logging.info(f"Custodian fee stats: {custodian_fee_stats}")

        # 处理投资顾问固定费率数据
        advisor_fee_stats = stats_df['投资顾问固定费率'].astype(str).value_counts().to_dict()
        logging.info(f"Advisor fee stats: {advisor_fee_stats}")

        # 确保必要的列存在
        required_columns = ['产品简称', '产品类型', '产品成立\n日期', '开放周期', '托管机构', '管理部门', '预警线（元）', '止损线（元）']
        missing_columns = [col for col in required_columns if col not in stats_df.columns]
        if missing_columns:
            error_msg = f"Missing columns: {', '.join(missing_columns)}"
            logging.error(error_msg)
            return jsonify({"error": error_msg}), 400

        # 处理日期列
        stats_df['产品成立日期'] = pd.to_datetime(stats_df['产品成立\n日期'], errors='coerce')
        logging.info(f"Unique values in '产品成立日期' column: {stats_df['产品成立日期'].unique()}")
        
        # 计算每年新增产品数量（按产品类型分组）
        yearly_product_count = stats_df.groupby([stats_df['产品成立日期'].dt.year, '产品类型']).size().unstack(fill_value=0)
        yearly_product_count_data = [
            {
                'year': str(year),
                '固定收益类': int(row.get('固定收益类', 0)),
                '混合类': int(row.get('混合类', 0)),
                '权益类': int(row.get('权益类', 0))
            }
            for year, row in yearly_product_count.iterrows()
        ]
        logging.info(f"Yearly product count data: {yearly_product_count_data}")

        # 计算当前日期
        current_date = pd.Timestamp.now()

        # 计算存续时长(年)
        stats_df['存续时长'] = (current_date - stats_df['产品成立\n日期']).dt.days / 365.25
        stats_df['存续时长'] = stats_df['存续时长'].astype(int)  # 取整数年

        # 现在可以计算存续时长分布
        duration_distribution = stats_df.groupby(['存续时长', '产品类型']).size().unstack(fill_value=0)

        # 修改 duration_distribution_data 的生成方式
        duration_distribution_data = [
            {
                'duration': str(duration),
                '固定收益类': int(row.get('固定收益类', 0)),
                '混合类': int(row.get('混合类', 0)),
                '权益类': int(row.get('权益类', 0))
            }
            for duration, row in duration_distribution.iterrows()
        ]
        logging.info(f"Duration distribution data: {duration_distribution_data}")

        # 其他统计
        product_count = stats_df['产品简称'].nunique()
        product_types = stats_df['产品类型'].value_counts().to_dict()
        open_cycle_stats = stats_df['开放周期'].value_counts().to_dict()
        custodian_stats = stats_df['托管机构'].value_counts().to_dict()
        management_department_stats = stats_df['管理部门'].value_counts().to_dict()

        # 处理预警线和止损线数据
        warning_stop_loss_data = stats_df[['预警线（元）', '止损线（元）']].value_counts().reset_index(name='count')
        warning_stop_loss_data = warning_stop_loss_data.rename(columns={'预警线（元）': 'warning_line', '止损线（元）': 'stop_loss_line'})
        warning_stop_loss_data = warning_stop_loss_data.to_dict('records')
        logging.info(f"Warning stop loss data: {warning_stop_loss_data[:5]}")  # 只记录前5条数据

        response_data = {
            'product_count': product_count,
            'product_types': product_types,
            'open_cycle_stats': open_cycle_stats,
            'custodian_stats': custodian_stats,
            'management_department_stats': management_department_stats,
            'yearly_product_count': yearly_product_count_data,
            'duration_distribution': duration_distribution_data,
            'warning_stop_loss_data': warning_stop_loss_data,
            'first_purchase_stats': first_purchase_stats,
            'additional_purchase_stats': additional_purchase_stats,
            'redemption_stats': redemption_stats,
            'min_holding_stats': min_holding_stats,
            'risk_level_stats': risk_level_stats,
            'management_fee_stats': management_fee_stats,
            'custodian_fee_stats': custodian_fee_stats,
            'advisor_fee_stats': advisor_fee_stats
        }
        logging.info(f"Response data: {json.dumps(response_data, ensure_ascii=False, default=str)}")
        return jsonify(response_data)
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/api/product-performance', methods=['GET'])
def get_product_performance():
    try:
        # 读取CSV文件
        df = pd.read_csv(performance_data_path, encoding='utf-8')
        
        # 打印列名和前���行数据
        logging.info(f"Columns in the CSV file: {df.columns.tolist()}")
        logging.info(f"First few rows of data:\n{df.head().to_string()}")
        
        # 重命名列，移除列名中的换行符
        df.columns = df.columns.str.replace('\n', '')
        
        # 将DataFrame转换为字典，并处理NaN值
        performance_data = df.replace({np.nan: None}).to_dict(orient='records')
        
        # 获取列名
        columns = df.columns.tolist()
        
        response_data = {
            'performance_data': performance_data,
            'columns': columns
        }
        
        # 使用自定义的JSON编码器
        class CustomJSONEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                elif isinstance(obj, np.floating):
                    return float(obj)
                elif isinstance(obj, np.ndarray):
                    return obj.tolist()
                else:
                    return super(CustomJSONEncoder, self).default(obj)

        logging.info("Successfully processed performance data")
        return json.dumps(response_data, cls=CustomJSONEncoder), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# 加载数据
data_dir = os.path.join(current_dir, '..', 'data')
initial_holdings_path = os.path.join(data_dir, '2023DEC.csv')
trades_path = os.path.join(data_dir, 'TRADES_LOG.csv')
product_info_path = os.path.join(data_dir, 'PRODUCT_INFO.csv')
client_sales_path = os.path.join(data_dir, 'CLIENT_LIST.csv')

start_date = date(2023, 12, 31)
initial_holdings = load_initial_holdings(initial_holdings_path)
trades, end_date = load_trades(trades_path)
product_info = load_product_info(product_info_path)
client_sales = load_client_sales(client_sales_path)

# 计算数据
daily_holdings = calculate_daily_holdings(initial_holdings, trades, start_date, end_date)
daily_income, sales_income, client_income = calculate_daily_income(daily_holdings, product_info, client_sales)
cumulative_sales_income = calculate_cumulative_income(sales_income)
cumulative_client_income = calculate_cumulative_income(client_income)
client_stats, fund_stats, sales_stats = show_income_statistics(daily_income, sales_income, client_income, daily_holdings, product_info)
forecasts = generate_forecasts(daily_income, product_info, daily_holdings, trades, end_date)
sales_person_breakdowns = generate_sales_person_breakdowns(daily_income, client_sales)
client_breakdowns = generate_client_breakdowns(daily_income)

# 添加新的路由处理函数
@app.route('/api/dashboard')
def get_dashboard():
    try:
        logging.info("Processing dashboard data")
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
            'income_trend': income_trend,
            'end_date': end_date.isoformat()  # 添加结束日期到返回数据中
        }

        logging.info("Dashboard data processed successfully")
        return jsonify(dashboard_data)
    except Exception as e:
        logging.error(f"Error processing dashboard data: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({'error': 'An error occurred while processing dashboard data'}), 500

@app.route('/api/sales')
def get_sales():
    try:
        logging.info("Processing sales data")
        logging.info(f"Start date: {start_date}, End date: {end_date}")
        logging.info(f"Number of sales persons: {len(sales_income[max(sales_income.keys())])}")
        
        sales_data = {
            'salesPersons': [],
            'dailyContribution': [],
            'individualPerformance': {},
            'end_date': end_date.isoformat()
        }
        
        # 获取所有销售人员,包括 "Unknown"
        all_sales_persons = set(sales_income[max(sales_income.keys())].keys())
        logging.info(f"All sales persons: {all_sales_persons}")
        
        # 添加销售人员数据
        for sales_person in all_sales_persons:
            cumulative_income = sum(day.get(sales_person, 0) for day in sales_income.values())
            total_clients = len([client for client, sp in client_sales.items() if sp == sales_person])
            if sales_person == "Unknown":
                total_clients = len([client for client in daily_income[max(daily_income.keys())] if client_sales.get(client) == "Unknown"])
            
            sales_data['salesPersons'].append({
                'name': sales_person,
                'cumulativeIncome': cumulative_income,
                'totalClients': total_clients
            })
            logging.info(f"Sales person: {sales_person}, Cumulative income: {cumulative_income}, Total clients: {total_clients}")
        
        # 添加每日贡献数据
        for date in sorted(sales_income.keys()):
            daily_data = {'date': date.isoformat()}
            daily_data.update(sales_income[date])
            sales_data['dailyContribution'].append(daily_data)
        
        # 添加个人表现数据
        for sales_person in all_sales_persons:
            sales_data['individualPerformance'][sales_person] = []
            for date in sorted(daily_income.keys()):
                performance = {
                    'date': date.isoformat(),
                    'income': sales_income[date].get(sales_person, 0),
                    'clients': {},
                    'funds': {}
                }
                # 添加客户和基金的细分数据
                for client, client_funds in daily_income[date].items():
                    if client_sales.get(client, "Unknown") == sales_person:
                        for fund, income in client_funds.items():
                            performance['clients'][client] = performance['clients'].get(client, 0) + income
                            performance['funds'][fund] = performance['funds'].get(fund, 0) + income
                sales_data['individualPerformance'][sales_person].append(performance)
           
            # 添加调试信息
            if sales_person == "Unknown":
                logging.info(f"Unknown sales person performance: {sales_data['individualPerformance']['Unknown']}")
        
        logging.info(f"Processed data for {len(sales_data['salesPersons'])} sales persons")
        return jsonify(sales_data)
    except Exception as e:
        logging.error(f"Error processing sales data: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({'error': 'An error occurred while processing sales data'}), 500

@app.route('/api/clients')
def get_clients():
    try:
        logging.info("Processing clients data")
        clients_data = []

        for client, sales_person in client_sales.items():
            logging.debug(f"Processing client: {client}, Sales Person: {sales_person}")
            client_value = sum(sum(daily_income[date].get(client, {}).values()) for date in daily_income)
            logging.debug(f"Client value: {client_value}")

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

        logging.info(f"Processed data for {len(clients_data)} sales persons")
        logging.debug(f"Clients data: {clients_data}")

        return jsonify(clients_data)
    except Exception as e:
        logging.error(f"Error processing clients data: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({'error': 'An error occurred while processing clients data'}), 500

@app.route('/api/province_counts')
def get_province_counts():
    try:
        logging.info("Processing province count data")
        provinces = [client_sales[client].split('-')[0] for client in client_sales if '-' in client_sales[client]]
        province_counts = dict(Counter(provinces))
        return jsonify(province_counts)
    except Exception as e:
        logging.error(f"Error processing province count data: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({'error': 'An error occurred while processing province count data'}), 500

@app.route('/api/funds')
def get_funds():
    try:
        logging.info("Processing funds data")
        fund_income = calculate_fund_income(daily_income)
        logging.info(f"Fund income: {fund_income}")  # 添加日志
        funds_data = [
            {
                "name": fund,
                "income": income
            }
            for fund, income in fund_income.items()
        ]
        funds_data.sort(key=lambda x: x['income'], reverse=True)
        logging.info(f"Sorted funds data (first 5 items): {funds_data[:5]}")  # 添加日志

        funds_breakdown = calculate_all_funds_client_breakdown(daily_income)
        logging.info(f"Funds breakdown (first 2 items): {funds_breakdown[:2]}")  # 加日志

        response_data = {
            "allFunds": funds_data,
            "fundsBreakdown": funds_breakdown
        }

        logging.info("Funds data processed successfully")
        return jsonify(response_data)
    except Exception as e:
        logging.error(f"Error processing funds data: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({'error': 'An error occurred while processing funds data'}), 500

# 创建一个线程锁来处理并发
db_lock = threading.Lock()

# 初始化数据库
def init_db():
    with sqlite3.connect('calendar_events.db') as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS events
            (id INTEGER PRIMARY KEY AUTOINCREMENT,
             date TEXT,
             person TEXT,
             content TEXT,
             last_modified INTEGER)
        ''')
        conn.commit()

init_db()

# 获取所有事件
@app.route('/api/calendar-events', methods=['GET'])
def get_calendar_events():
    with sqlite3.connect('calendar_events.db') as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events")
        events = cursor.fetchall()
    
    formatted_events = {}
    for event in events:
        date = event[1]
        if date not in formatted_events:
            formatted_events[date] = []
        formatted_events[date].append({
            'id': event[0],
            'person': {'name': event[2], 'color': get_color_for_person(event[2])},
            'content': event[3],
            'last_modified': event[4]
        })
    
    return jsonify(formatted_events)

# 添加新事件
@app.route('/api/calendar-events', methods=['POST'])
def add_calendar_event():
    data = request.json
    logging.info(f"Received data: {data}")  # 添加日志记录
    
    try:
        with db_lock:
            with sqlite3.connect('calendar_events.db') as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO events (date, person, content, last_modified)
                    VALUES (?, ?, ?, ?)
                ''', (
                    data.get('date'),
                    data.get('person', {}).get('name'),
                    data.get('content'),
                    data.get('last_modified', int(time.time() * 1000))  # 如果没有提供，使用当前时间戳
                ))
                conn.commit()
        return jsonify({"message": "Event added successfully", "id": cursor.lastrowid}), 201
    except Exception as e:
        logging.error(f"Error adding calendar event: {str(e)}")
        return jsonify({"error": "Failed to add event", "details": str(e)}), 500

# 更新事件
@app.route('/api/calendar-events/<int:event_id>', methods=['PUT'])
def update_calendar_event(event_id):
    data = request.json
    with db_lock:
        with sqlite3.connect('calendar_events.db') as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE events
                SET content = ?, last_modified = ?
                WHERE id = ? AND last_modified < ?
            ''', (data['content'], data['last_modified'], event_id, data['last_modified']))
            if cursor.rowcount == 0:
                return jsonify({"message": "Event was modified by another user"}), 409
            conn.commit()
    return jsonify({"message": "Event updated successfully"}), 200

# 除事件
@app.route('/api/calendar-events/<int:event_id>', methods=['DELETE'])
def delete_calendar_event(event_id):
    with db_lock:
        with sqlite3.connect('calendar_events.db') as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
            conn.commit()
    return jsonify({"message": "Event deleted successfully"}), 200

def get_color_for_person(name):
    # 这里可以实现一个函数来为每个人分配固定的颜色
    colors = ['#f50', '#2db7f5', '#87d068', '#108ee9', '#f5a623', '#7265e6', '#ffbf00', '#00a2ae', '#ff85c0']
    return colors[hash(name) % len(colors)]

# 初始化留言板数据库
def init_forum_db():
    with sqlite3.connect('forum_messages.db') as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages
            (id INTEGER PRIMARY KEY AUTOINCREMENT,
             content TEXT NOT NULL,
             timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)
        ''')
        conn.commit()

init_forum_db()

# 添加新的 API 端点
@app.route('/api/forum/messages', methods=['GET', 'POST'])
def handle_forum_messages():
    if request.method == 'GET':
        with sqlite3.connect('forum_messages.db') as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM messages ORDER BY timestamp DESC")
            messages = cursor.fetchall()
        return jsonify([{'id': m[0], 'content': m[1], 'timestamp': m[2]} for m in messages])
    
    elif request.method == 'POST':
        content = request.json.get('content')
        if not content:
            return jsonify({'error': 'Content is required'}), 400
        
        with sqlite3.connect('forum_messages.db') as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO messages (content) VALUES (?)", (content,))
            conn.commit()
        return jsonify({'message': 'Message added successfully'}), 201

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)