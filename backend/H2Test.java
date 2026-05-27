public class H2Test {
  public static void main(String[] args) throws Exception {
    java.util.Properties props = new java.util.Properties();
    String url = "jdbc:h2:mem:test;DB_CLOSE_DELAY=-1;MODE=PostgreSQL;NON_KEYWORDS=KEY;INIT=RUNSCRIPT FROM 'src/main/resources/h2-init.sql'";
    System.out.println(url);
    java.sql.Driver driver = new org.h2.Driver();
    try (java.sql.Connection c = driver.connect(url, props)) {
      System.out.println(c.getSchema());
    }
  }
}
