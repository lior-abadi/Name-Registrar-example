const {loadFixture, time} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NameRegistrar", function () {

  async function deployWithFixture() {

    // Contracts are deployed using the first signer/account by default
    const [alice, bob] = await ethers.getSigners();

    const Registrar = await ethers.getContractFactory("NameRegistrar");
    const registrar = await Registrar.deploy();

    return { registrar, alice, bob };
  }

  describe("Deployment", function () {
    it("Deploys an instance", async function () {
      const { registrar } = await loadFixture(deployWithFixture);

      console.log(`Contract Deployed at ${registrar.address}`)

      expect(registrar.address).not.eql(ethers.constants.AddressZero);
    });
  });

  describe("Commitment & Registrations", function () {
    describe("Commitment", function () {
      it("Should commit a new nameHash", async function () {
        const { registrar, alice, bob } = await loadFixture(
          deployWithFixture
        );
        
        const commitmentHash = await registrar.connect(alice).createCommitment(
            "Alice222",
            9122018
        );

        const tx = await registrar.connect(alice).sendCommitment(commitmentHash);
        await tx.wait();

        expect(await registrar.commitmentTimesamp(commitmentHash)).to.be.greaterThan(0);        
      });

      it("Should not allow to commit a duplicate", async function () {
        const { registrar, alice } = await loadFixture(
          deployWithFixture
        );
        
        const commitmentHash = await registrar.connect(alice).createCommitment(
            "Alice222",
            9122018
        );

        const tx = await registrar.connect(alice).sendCommitment(commitmentHash);
        await tx.wait();

        expect(await registrar.commitmentTimesamp(commitmentHash)).to.be.greaterThan(0); 
        
        await expect(registrar.connect(alice).sendCommitment(commitmentHash)).to.be.revertedWithCustomError(registrar, "AlreadyCommited");
      });
    });

    describe("Registrations", function () {
      it("Should Register a name", async function () {
        const { registrar, alice } = await loadFixture(
          deployWithFixture
        );
        
        const commitmentHash = await registrar.connect(alice).createCommitment(
            "Alice222",
            9122018
        );

        const tx = await registrar.connect(alice).sendCommitment(commitmentHash);
        await tx.wait();
        
        await time.increase(121);
        const tx2 = await registrar.connect(alice).registerName(
          "Alice222",
          9122018
        );
        await tx2.wait();
        
        const nameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Alice222"));

        expect(await registrar.ownerToNameHash(alice.address)).to.be.eq(nameHash);
        expect(await registrar.ownerToName(alice.address)).to.be.eq("Alice222");
        expect(await registrar.nameUnavailable(nameHash)).to.be.true;       
      });

      it("Should not allow to register before min time", async function () {
        const { registrar, alice } = await loadFixture(
          deployWithFixture
        );
        
        const commitmentHash = await registrar.connect(alice).createCommitment(
            "Alice222",
            9122018
        );

        const tx = await registrar.connect(alice).sendCommitment(commitmentHash);
        await tx.wait();
        
        await time.increase(100);

        await expect(registrar.connect(alice).registerName(
          "Alice222",
          9122018
        )).to.be.revertedWithCustomError(registrar, "NoCommitmentMadeOrMinTimePassed");
      });

      it("Should not allow to register after expiry", async function () {
        const { registrar, alice } = await loadFixture(
          deployWithFixture
        );
        
        const commitmentHash = await registrar.connect(alice).createCommitment(
            "Alice222",
            9122018
        );

        const tx = await registrar.connect(alice).sendCommitment(commitmentHash);
        await tx.wait();
        
        const day = 86400;
        await time.increase(day);

        await expect(registrar.connect(alice).registerName(
          "Alice222",
          9122018
        )).to.be.revertedWithCustomError(registrar, "CommitmentExpired");
      });

      it("Should not allow to register a duplicate", async function () {
        const { registrar, alice, bob } = await loadFixture(
          deployWithFixture
        );
        
        const commitmentHash = await registrar.connect(alice).createCommitment(
            "Alice222",
            9122018
        );

        const tx = await registrar.connect(alice).sendCommitment(commitmentHash);
        await tx.wait();
        
        await time.increase(200);

        const tx2 = await registrar.connect(alice).registerName(
          "Alice222",
          9122018
        );
        await tx2.wait();


        const commitmentHash2 = await registrar.connect(bob).createCommitment(
          "Alice222",
          9122018
        );

        const tx3 = await registrar.connect(bob).sendCommitment(commitmentHash2);
        await tx3.wait();
        
        await time.increase(200);

        await expect(registrar.connect(bob).registerName(
          "Alice222",
          9122018
        )).to.be.revertedWithCustomError(registrar, "NameUnavailable");
      });

      it("Should not allow to change your name", async function () {
        const { registrar, alice } = await loadFixture(
          deployWithFixture
        );
        
        const commitmentHash = await registrar.connect(alice).createCommitment(
            "Alice222",
            9122018
        );

        const tx = await registrar.connect(alice).sendCommitment(commitmentHash);
        await tx.wait();
        
        await time.increase(180);

        const tx2 = await registrar.connect(alice).registerName(
          "Alice222",
          9122018
        );
        await tx2.wait();

        await expect(registrar.connect(alice).sendCommitment(
          commitmentHash
        )).to.be.revertedWithCustomError(registrar, "AlreadyNamed");
      });

      it("Should not allow a bystander to frontrun other", async function () {
        const { registrar, alice, bob } = await loadFixture(
          deployWithFixture
        );
        
        const commitmentHash = await registrar.connect(alice).createCommitment(
            "Alice21",
            9122018
        );
        
        // Bob frontruns alice with her transaction
        const tx0 = await registrar.connect(bob).sendCommitment(commitmentHash);
        await tx0.wait();
        
        // Alice cant commit an already injected hash but she still will be able to register it
        await expect(registrar.connect(alice).sendCommitment(
          commitmentHash
        )).to.be.revertedWithCustomError(registrar, "AlreadyCommited");
        
        await time.increase(200);
        
        // Bob cannot claim a name he did not commit.
        await expect(registrar.connect(bob).registerName(
          "Alice21",
          9122018
        )).to.be.revertedWithCustomError(registrar, "CommitmentExpired");
        
        // Finally Alice claims the domain.
        const tx2 = await registrar.connect(alice).registerName(
          "Alice21",
          9122018
        );
        await tx2.wait();
      });

      it("Should Handle more than one registry simultaneously", async function () {
        const { registrar, alice, bob } = await loadFixture(
          deployWithFixture
        );
        
        const aliceHash = await registrar.connect(alice).createCommitment(
           "Alicia",
            9122018
        );
        const bobHash = await registrar.connect(bob).createCommitment(
          "Bob31",
          31
        );

        const tx = await registrar.connect(alice).sendCommitment(aliceHash);
        await tx.wait();

        const tx2 = await registrar.connect(bob).sendCommitment(bobHash);
        await tx2.wait();
        
        await time.increase(121);

        const tx3 = await registrar.connect(alice).registerName(
          "Alicia",
          9122018
        );
        await tx3.wait();

        const tx4 = await registrar.connect(bob).registerName(
          "Bob31",
          31
        );
        await tx4.wait();
        
        const aliceNameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Alicia"));

        expect(await registrar.ownerToNameHash(alice.address)).to.be.eq(aliceNameHash);
        expect(await registrar.ownerToName(alice.address)).to.be.eq("Alicia");
        expect(await registrar.nameUnavailable(aliceNameHash)).to.be.true;    
        

        const bobNameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Bob31"));

        expect(await registrar.ownerToNameHash(bob.address)).to.be.eq(bobNameHash);
        expect(await registrar.ownerToName(bob.address)).to.be.eq("Bob31");
        expect(await registrar.nameUnavailable(bobNameHash)).to.be.true;  
      });
      
      


    });

  });

});
