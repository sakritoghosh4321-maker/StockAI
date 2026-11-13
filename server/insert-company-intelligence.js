const pool = require("./db");

async function insertCompanyIntelligence() {
    try {

        const companies = [

            [
                "RELIANCE",
                "Reliance Industries is a diversified Indian company with major businesses across energy, retail and digital services.",
                "Energy, petrochemicals, retail, digital services and telecommunications.",
                "Energy products, petrochemicals, retail products, digital services and telecommunications services.",
                "Large-scale energy, retail and digital business operations.",
                "Ongoing business activities across energy, retail and digital businesses.",
                "Expansion of retail, digital and energy-related businesses.",
                "Digital ecosystem and business partnerships across multiple sectors.",
                "Continued expansion and diversification across energy, retail and digital businesses."
            ],

            [
                "TATAMOTORS",
                "Tata Motors is an Indian automobile company operating across passenger vehicles, commercial vehicles and electric mobility.",
                "Passenger vehicles, commercial vehicles and electric mobility.",
                "Passenger cars, SUVs, commercial vehicles and electric vehicles.",
                "Automotive product development and vehicle manufacturing programs.",
                "Vehicle supply, manufacturing and business development activities.",
                "Expansion of electric mobility and new vehicle platforms.",
                "Automotive technology and mobility partnerships.",
                "Growth in electric vehicles, mobility technology and new vehicle platforms."
            ],

            [
                "BEL",
                "Bharat Electronics Limited is an Indian defence electronics company serving strategic and government requirements.",
                "Defence electronics, radar systems, communication systems and electronic warfare solutions.",
                "Radar systems, communication equipment, electronic systems and defence technology.",
                "Defence equipment development and supply programs.",
                "Defence electronics supply and development contracts.",
                "Expansion of defence technology and indigenous electronics capabilities.",
                "Technology and defence-sector partnerships.",
                "Continued development of indigenous defence electronics and advanced systems."
            ],

            [
                "ADANIPOWER",
                "Adani Power is an Indian power generation company involved in thermal power generation and electricity supply.",
                "Power generation and energy infrastructure.",
                "Electricity generation and power supply services.",
                "Power generation capacity and infrastructure projects.",
                "Electricity supply and power-related commercial agreements.",
                "Expansion and development of power generation capacity.",
                "Energy-sector business and infrastructure partnerships.",
                "Growth in power generation capacity and energy infrastructure."
            ],

            [
                "TCS",
                "Tata Consultancy Services is an Indian information technology services and consulting company.",
                "IT services, consulting, software and digital transformation.",
                "Technology consulting, software services, cloud, digital transformation and enterprise solutions.",
                "Digital transformation and technology implementation programs.",
                "IT services, consulting and technology contracts with enterprises.",
                "Expansion of cloud, AI, digital and enterprise technology services.",
                "Technology partnerships and enterprise collaborations.",
                "Continued expansion in AI, cloud, digital transformation and global technology services."
            ],

            [
                "SBIN",
                "State Bank of India is a major Indian banking and financial services institution.",
                "Banking, lending, deposits, payments and financial services.",
                "Retail banking, corporate banking, loans, deposits, payments and financial products.",
                "Banking infrastructure and digital banking initiatives.",
                "Corporate, retail and financial service agreements.",
                "Expansion of digital banking and financial services.",
                "Financial technology and banking partnerships.",
                "Continued growth in digital banking, financial services and technology adoption."
            ]

        ];


        const sql = `
            INSERT INTO company_intelligence
            (
                symbol,
                company_overview,
                business_activities,
                products_services,
                order_book,
                contracts,
                projects,
                partnerships,
                future_developments
            )
            VALUES ?
            ON DUPLICATE KEY UPDATE

                company_overview = VALUES(company_overview),
                business_activities = VALUES(business_activities),
                products_services = VALUES(products_services),
                order_book = VALUES(order_book),
                contracts = VALUES(contracts),
                projects = VALUES(projects),
                partnerships = VALUES(partnerships),
                future_developments = VALUES(future_developments)
        `;


        await pool.query(sql, [companies]);


        console.log(
            "Company Intelligence data inserted successfully!"
        );


    } catch (error) {

        console.error(
            "Error inserting Company Intelligence data:",
            error.message
        );

    } finally {

        await pool.end();

    }
}


insertCompanyIntelligence();